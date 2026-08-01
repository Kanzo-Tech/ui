"use client";

import { count, Query } from "@uwdata/mosaic-sql";
import { fillColumn, numbers, type Coordinator } from "@kanzo-tech/ui/analytics";
import type { BoundedSource, Slice, SliceQuery, SliceRequest } from "./bounded";
import { onceQuery } from "./once-query";

/**
 * A `BoundedSource` over two ordinary relations in DuckDB.
 *
 * On a subpath because Mosaic is an optional peer and this is the half that needs it: a host drawing
 * arrays it already holds takes `memorySource` and pays for no database. Splitting them is what lets
 * that promise be true rather than merely stated.
 *
 * **Not GraphAr, and that is the point.** The contract is neutral about storage so that fossil's
 * `viewport` verb and a plain relation can both satisfy it — which is what made it possible to
 * measure bounded against unbounded before committing to a layout on disk. When the verb lands it
 * drops in beside this and the numbers stay comparable.
 */

export interface DuckSourceOptions {
  coordinator: Coordinator;
  /** The node relation. */
  nodes: string;
  /** The edge relation, as pairs of node ids. */
  edges: string;
  /**
   * A **dense** integer id — `0..n-1`, no gaps.
   *
   * Dense because `links` refers to positions rather than to ids, so a consumer never pays for an
   * id→index map. GraphAr's `dense_id` is this column by another name.
   */
  idField?: string;
  xField?: string;
  yField?: string;
  /**
   * The column whose distinct values become colour ordinals, and the groups aggregate mode collapses
   * to. Ranked rather than read: a category column is text as often as not, and `Number("c3")` is
   * `NaN`, which would quietly colour every point slot zero.
   */
  categoryField?: string;
  /** What the size ramp is spent on. Omitted, every point is drawn at one radius. */
  sizeField?: string;
  sourceField?: string;
  targetField?: string;
}

interface Columns {
  id: string;
  x: string;
  y: string;
  category: string;
  size: string | undefined;
  source: string;
  target: string;
}

export function duckBoundedSource(options: DuckSourceOptions): BoundedSource {
  const { coordinator, edges, nodes } = options;
  const columns: Columns = {
    id: options.idField ?? "id",
    x: options.xField ?? "x",
    y: options.yField ?? "y",
    category: options.categoryField ?? "community",
    size: options.sizeField,
    source: options.sourceField ?? "source",
    target: options.targetField ?? "target",
  };

  return {
    async total() {
      const rows = await onceQuery(coordinator, () => Query.from(nodes).select({ n: count() }));
      return Number(numbers(rows, "n")[0] ?? 0);
    },

    /**
     * Regions only. This source is two relations and a spatial predicate — it has no adjacency
     * index, so a neighbourhood query would mean recursive joins over the whole edge table, which is
     * the unbounded pattern wearing a bounded interface. A typed refusal is the honest answer;
     * fossil's `find_neighbors` is the source that should answer it.
     */
    supports(kind) {
      return kind === "region";
    },

    async slice(request: SliceRequest): Promise<Slice> {
      const { limit, lodThreshold, pinned, query } = request;
      if (query.kind !== "region") {
        throw new Error("this source answers regions only — see supports()");
      }
      return query.view.zoom < lodThreshold
        ? aggregate(coordinator, nodes, edges, columns, limit)
        : detail(coordinator, nodes, edges, columns, query.view, limit, pinned);
    },
  };
}

/**
 * The re-indexing happens in SQL, and that is the whole trick.
 *
 * `row_number() - 1` over the visible set gives every returned point a position in the arrays about
 * to be built, so the edge query can join to it twice and hand back links that already speak in
 * those positions. No id→index map is constructed in JavaScript — which is the 148 ms `load()` spent
 * at 200,000 nodes, gone by construction rather than by optimisation.
 *
 * The `LIMIT` sits inside the CTE, so the numbering is over what survives it. Numbering first and
 * limiting after would hand out indices into an array that was never built.
 */
/**
 * A rectangle as a SQL predicate, and an **unbounded** rectangle as no predicate at all.
 *
 * `shouldSlice` answers `false` for a graph that fits, and the loop then asks for everything — a
 * viewport whose edges are `±Infinity`. Interpolated, that reads `x BETWEEN -Infinity AND Infinity`,
 * and SQL has no infinity literal: DuckDB parses `Infinity` as a **column name** and fails with
 * `Referenced column "Infinity" not found`. So an open edge contributes no clause, and a rectangle
 * open on every side is `TRUE` — which is also the right plan, because a query that wants every row
 * has nothing to prune.
 */
function bboxSql(c: Columns, view: Extract<SliceQuery, { kind: "region" }>["view"]): string {
  const bounds: [string, number, string][] = [
    [c.x, view.xMin, ">="],
    [c.x, view.xMax, "<="],
    [c.y, view.yMin, ">="],
    [c.y, view.yMax, "<="],
  ];
  const clauses = bounds
    .filter(([, value]) => Number.isFinite(value))
    .map(([column, value, op]) => `${column} ${op} ${value}`);
  return clauses.length > 0 ? clauses.join(" AND ") : "TRUE";
}

function visibleCte(nodes: string, c: Columns, where: string, limit: number): string {
  const size = c.size ? `, ${c.size} AS size` : "";
  return `WITH vis AS (
    SELECT ${c.id} AS id, ${c.x} AS x, ${c.y} AS y${size},
           (dense_rank() OVER (ORDER BY ${c.category}) - 1)::INTEGER AS category,
           (row_number() OVER (ORDER BY ${c.id}) - 1)::INTEGER AS local
    FROM ${nodes}
    WHERE ${where}
    LIMIT ${limit}
  )`;
}

async function detail(
  coordinator: Coordinator,
  nodes: string,
  edges: string,
  c: Columns,
  view: Extract<SliceQuery, { kind: "region" }>["view"],
  limit: number,
  pinned: number[] | undefined,
): Promise<Slice> {
  const bbox = bboxSql(c, view);
  // A dragged node is drawn where the reader dropped it and indexed where it always was, so the
  // rectangle cannot find it. Riding along in the predicate is what keeps it on screen — and it
  // stays a predicate rather than a second query so the numbering still covers everything returned.
  const held = pinned?.length ? ` OR ${c.id} IN (${pinned.join(",")})` : "";
  const cte = visibleCte(nodes, c, `(${bbox})${held}`, limit);

  /**
   * How many matched, separately from how many came back.
   *
   * Without it the view cannot tell a reader "there is more here than I am showing you", and a
   * truncated slice looks exactly like a complete one — which is the failure this whole branch has
   * been about.
   */
  const [points, links, matched] = await Promise.all([
    onceQuery(
      coordinator,
      () =>
        `${cte} SELECT local, id, x, y, category${c.size ? ", size" : ""} FROM vis ORDER BY local`,
    ),
    // Both endpoints must be visible: an edge with one end off-screen has nowhere to land.
    onceQuery(
      coordinator,
      () => `${cte}
        SELECT s.local AS src, t.local AS dst
        FROM ${edges} e
        JOIN vis s ON e.${c.source} = s.id
        JOIN vis t ON e.${c.target} = t.id`,
    ),
    onceQuery(coordinator, () => `SELECT count(*) AS n FROM ${nodes} WHERE ${bbox}`),
  ]);

  return {
    mode: "detail",
    n: Number(numbers(matched, "n")[0] ?? 0),
    ...arrays(points, links, limit, c.size ? "size" : undefined),
  };
}

/**
 * Zoomed out far enough that individual points are not information.
 *
 * One super-node per group, at its centroid, weighted by how many it stands for — so a view of
 * everything is a few thousand marks whatever the corpus. The aggregation is `GROUP BY` in DuckDB,
 * which means the bytes crossing into JavaScript are already the answer rather than the input to it.
 */
async function aggregate(
  coordinator: Coordinator,
  nodes: string,
  edges: string,
  c: Columns,
  limit: number,
): Promise<Slice> {
  const cte = `WITH vis AS (
    SELECT ${c.category} AS grp, avg(${c.x}) AS x, avg(${c.y}) AS y, count(*) AS weight,
           (dense_rank() OVER (ORDER BY ${c.category}) - 1)::INTEGER AS category,
           (row_number() OVER (ORDER BY ${c.category}) - 1)::INTEGER AS local
    FROM ${nodes} GROUP BY ${c.category} LIMIT ${limit}
  )`;

  const [points, links, matched] = await Promise.all([
    onceQuery(
      coordinator,
      () => `${cte} SELECT local, local AS id, x, y, category, weight FROM vis ORDER BY local`,
    ),
    // Which groups touch, not how often: at this zoom the multiplicity is not a readable difference.
    onceQuery(
      coordinator,
      () => `${cte}
        SELECT DISTINCT s.local AS src, t.local AS dst
        FROM ${edges} e
        JOIN ${nodes} sn ON e.${c.source} = sn.${c.id}
        JOIN ${nodes} tn ON e.${c.target} = tn.${c.id}
        JOIN vis s ON sn.${c.category} = s.grp
        JOIN vis t ON tn.${c.category} = t.grp
        WHERE s.local <> t.local`,
    ),
    onceQuery(coordinator, () => `SELECT count(*) AS n FROM ${nodes}`),
  ]);

  const built = arrays(points, links, limit);
  const weights = new Float32Array(built.ids.length);
  fillColumn(points, "weight", weights);
  return { mode: "aggregate", n: Number(numbers(matched, "n")[0] ?? 0), ...built, weights };
}

/**
 * Arrow columns to the parallel typed arrays the renderer takes — sized once, filled in place.
 *
 * `fillColumn` rather than `numbers`: Arrow already hands back a typed buffer, and the obvious route
 * through `Array.from(...).map(Number)` allocates two full-length boxed arrays on the way to a third
 * that was the actual destination. Three copies to move nothing. Here the point buffers are sized
 * against the query's own `LIMIT` and each column is written straight into its stride, so `x` and
 * `y` interleave with no seam between them and no intermediate at all.
 */
function arrays(
  points: unknown,
  links: unknown,
  limit: number,
  sizeField?: string,
): Omit<Slice, "mode" | "n" | "weights"> {
  const positions = new Float32Array(limit * 2);
  const n = fillColumn(points, "x", positions, 0, 2);
  fillColumn(points, "y", positions, 1, 2);

  const ids = new Uint32Array(n);
  fillColumn(points, "id", ids);
  const categories = new Uint16Array(n);
  fillColumn(points, "category", categories);

  let sizes: Float32Array | undefined;
  if (sizeField) {
    sizes = new Float32Array(n);
    fillColumn(points, sizeField, sizes);
  }

  // The edge count is not bounded by the point limit, so it is asked for rather than assumed.
  const edgeCount = (links as { numRows?: number } | null)?.numRows ?? countOf(links);
  const edges = new Float32Array(edgeCount * 2);
  const wrote = fillColumn(links, "src", edges, 0, 2);
  fillColumn(links, "dst", edges, 1, 2);

  return {
    ids,
    positions: positions.subarray(0, n * 2),
    links: edges.subarray(0, wrote * 2),
    categories,
    sizes,
  };
}

/** A row count for a result that does not advertise one, without materialising the rows. */
function countOf(rows: unknown): number {
  const child = (rows as { getChild?: (f: string) => { length: number } | null })?.getChild?.("src");
  if (child) return child.length;
  return Array.from(rows as Iterable<unknown>).length;
}
