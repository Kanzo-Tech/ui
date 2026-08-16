"use client";

import { count, Query } from "@uwdata/mosaic-sql";
import { column, fillColumn, numbers, type Coordinator } from "@kanzo-tech/ui/analytics";
import type { BoundedSource, Slice, SliceRequest, Viewport } from "./bounded";
import { onceQuery } from "./once-query";
import { denseOf, typeOf, vertexId, SUPERNODE, type VertexId } from "./resident";

/**
 * A `BoundedSource` over two ordinary relations in DuckDB.
 *
 * On a subpath because Mosaic is an optional peer and this is the half that needs it: a host drawing
 * arrays it already holds takes `memorySource` and pays for no database. Splitting them is what lets
 * that promise be true rather than merely stated.
 *
 * **Neutral about storage, and that is the point.** The neutrality let bounded be measured against
 * unbounded before anything committed to a layout on disk — and it is the reason this file survived
 * a decision on the other side of the seam. The verb it was written to sit beside never landed:
 * `viewport` was dropped and GraphAr with it, because the camera is addressed rather than queried.
 * What replaces it is a tile fetched by a computed URL, which is another source.
 */

/**
 * `onceQuery` is on this subpath and not on the root barrel, and it is the reason the promise above
 * was false for as long as it was stated. Its module imports `@kanzo-tech/ui/analytics`, which
 * statically imports `@uwdata/mosaic-core`, `@uwdata/mosaic-sql` and `@uwdata/vgplot` — so a root
 * barrel that re-exported it made `import { memorySource } from "@kanzo-tech/graph"` throw for
 * every host without them. It has never had a caller outside a Mosaic context; this file and the
 * two showcases are all of them. Re-exported here rather than left module-private because those
 * showcases read a relation directly, and a second hand-written throwaway client at each call site
 * is the drift `useChartQuery` states the rule against.
 */
export { onceQuery } from "./once-query";

export interface DuckSourceOptions {
  coordinator: Coordinator;
  /** The node relation. */
  nodes: string;
  /** The edge relation, as pairs of node ids. */
  edges: string;
  /**
   * Which vertex type this relation is.
   *
   * Required, and with no default, because the source is the only thing that knows: a `dense_id`
   * numbers within one type, so the identity a slice carries is only completed here. A corpus of one
   * type is type `0` and has to say so — a defaulted `0` would let a second relation ship the same
   * identities as the first with nothing raised.
   */
  typeIndex: number;
  /**
   * A **dense** integer id — `0..n-1`, no gaps.
   *
   * Dense because `links` refers to positions rather than to ids, so a consumer never pays for an
   * id→index map. GraphAr's `dense_id` is this column by another name.
   */
  idField?: string;
  /**
   * The identity column — the subject IRI. **Omitted, a slice carries addresses only.**
   *
   * A `dense_id` says where a vertex is; the IRI says which vertex it is, and only the second
   * survives the layout being redone. The corpus writes it as `subject`, non-null and unique within
   * a type, which is why that is the name here — but it stays opt-in rather than defaulted, because
   * reading it costs 1.87× the drawing tile and most points are painted rather than named.
   *
   * Set it when something outlives a session: a bookmark, a link out, a selection that has to mean
   * the same thing after the next `fossil run`.
   */
  subjectField?: string;
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
  /** `undefined` when the host did not ask to be able to name a vertex. */
  subject: string | undefined;
  x: string;
  y: string;
  category: string;
  size: string | undefined;
  source: string;
  target: string;
}

export function duckBoundedSource(options: DuckSourceOptions): BoundedSource {
  const { coordinator, edges, nodes, typeIndex } = options;
  const columns: Columns = {
    id: options.idField ?? "id",
    subject: options.subjectField,
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
     * Regions only, and it says so by **not having** `explore`.
     *
     * This source is two relations and a spatial predicate — it has no adjacency index, so a
     * neighbourhood query would mean recursive joins over the whole edge table, which is the
     * unbounded pattern wearing a bounded interface. It used to say that with a predicate and a
     * throw; now the absence is the statement, and asking is a compile error.
     */
    async slice(request: SliceRequest): Promise<Slice> {
      const { fill, limit, lodThreshold, pinned, r, view } = request;
      // The request wins over the constructor, because a channel is what the caller wants drawn now
      // and the options are what this relation happens to hold. Two places deciding one colour is
      // the state this move exists to end.
      const asked: Columns = { ...columns, category: fill ?? columns.category, size: r ?? columns.size };
      return view.zoom < lodThreshold
        ? aggregate(coordinator, nodes, edges, asked, limit)
        : detail(coordinator, nodes, edges, asked, view, limit, typeIndex, pinned);
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
function bboxSql(c: Columns, view: Viewport): string {
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
  // Selected in the CTE rather than joined back afterwards: the numbering is over what survives the
  // LIMIT, and a second pass keyed on `local` would be a second scan to fetch a column the first one
  // was already standing on.
  const subject = c.subject ? `, ${c.subject} AS subject` : "";
  return `WITH vis AS (
    SELECT ${c.id} AS id, ${c.x} AS x, ${c.y} AS y${size}${subject},
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
  view: Viewport,
  limit: number,
  typeIndex: number,
  pinned: VertexId[] | undefined,
): Promise<Slice> {
  const bbox = bboxSql(c, view);
  // A dragged node is drawn where the reader dropped it and indexed where it always was, so the
  // rectangle cannot find it. Riding along in the predicate is what keeps it on screen — and it
  // stays a predicate rather than a second query so the numbering still covers everything returned.
  //
  // Only this relation's own vertices: a pinned set spans the whole canvas, and asking one node
  // table for another type's dense ids returns the wrong rows rather than none.
  const mine = (pinned ?? []).filter((v) => typeOf(v) === typeIndex).map(denseOf);
  const held = mine.length > 0 ? ` OR ${c.id} IN (${mine.join(",")})` : "";
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
        `${cte} SELECT local, id, x, y, category${c.size ? ", size" : ""}${
          c.subject ? ", subject" : ""
        } FROM vis ORDER BY local`,
    ),
    // Both endpoints must be visible. An edge with one end off-slice is dropped, and that is a **limit of this reader rather
    // than of the corpus.** It reads like an impossibility and is not: a corpus carries
    // `by_target.parquet`, the CSC half, precisely so that "an edge with one endpoint off screen"
    // can be answered — it is a second addressing pass, not a missing fact. What is true is
    // narrower: this slice has no position to draw the far end at, because the far end is not in
    // the answer. Drawing it needs a segment clipped to the viewport, which is a renderer decision
    // nobody has made, and the vertices to clip against, which is the CSC read nobody has written.
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
    ...arrays(points, links, limit, typeIndex, c.size ? "size" : undefined, c.subject !== undefined),
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

  // The reserved type, because these points are groups rather than vertices: the query numbers them
  // `0..k` and leaving them in the corpus' own type makes group 3 and vertex 3 one identity.
  const built = arrays(points, links, limit, SUPERNODE);
  const weights = new Float32Array(built.vertices.length);
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
  typeIndex: number,
  sizeField?: string,
  withSubjects = false,
): Omit<Slice, "mode" | "n" | "weights"> {
  const positions = new Float32Array(limit * 2);
  const n = fillColumn(points, "x", positions, 0, 2);
  fillColumn(points, "y", positions, 1, 2);

  // The dense ids land in a scratch and are widened into identities as they are copied across.
  //
  // In place, into the destination, would be better and is not available: `fillColumn` writes
  // `Number(…)`, and a `BigUint64Array` element takes a `bigint` only — assigning a `number` to one
  // throws rather than coercing. That refusal is the same guarantee this whole change is for, so the
  // extra `n`-long buffer is the price of the boundary being enforced by the runtime and not by us.
  const dense = new Float64Array(n);
  fillColumn(points, "id", dense);
  const vertices = new BigUint64Array(n);
  for (let i = 0; i < n; i++) vertices[i] = vertexId(typeIndex, dense[i] as number);
  const categories = new Uint16Array(n);
  fillColumn(points, "category", categories);

  // `column` rather than `fillColumn`: an IRI is a string, so there is no typed buffer to write
  // into and no interleaving to express. It is the one thing a slice carries that never reaches the
  // GPU, which is why asking for it is a decision rather than a default.
  const subjects = withSubjects ? (column(points, "subject") as string[]) : undefined;

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
    vertices,
    subjects,
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

/**
 * A corpus that fossil wrote, read by address.
 *
 * **The five things a call site used to know, and now does not.** Drawing a corpus meant deriving
 * the chunk URLs from a `chunk_size` copied by hand, knowing how a tile is named, knowing what the
 * edge directory is called, knowing GraphAr's column names, and knowing that a glob cannot work over
 * a plain HTTP origin because there is no listing. Five conventions and about forty lines, none of
 * it the business of something that wants to draw a graph. `decisions/a-tile-is-an-address-not-a-verb.md`
 * carries the argument; the copied `chunk_size` carries the evidence, because it went stale and read
 * a fraction of a corpus in silence for as long as it did.
 *
 * The consumer knows one thing: **where the corpus is.**
 *
 * ```ts
 * const source = await corpusSource({ coordinator, dest: "/bench/1000000" });
 * ```
 *
 * **Addressed, not queried.** The manifest and the per-tile boxes are read once and kept; after that
 * a camera move is arithmetic over boxes and a list of URLs. There is deliberately no request on the
 * path between the camera moving and a URL being computable — the moment there is one, this has
 * become the `viewport` verb fossil deleted.
 *
 * **What it is not.** It takes no column names and no type index. Those come from the manifest or
 * they do not come: a corpus reader that also accepts `idField` is `duckBoundedSource` with extra
 * steps, and there is already one of those for the case this is not — an arbitrary relation with
 * `x`/`y` that nobody wrote as a corpus.
 */

export interface OpenCorpusOptions {
  coordinator: Coordinator;
  /** Where the corpus lives, without a trailing slash — the directory holding `graph.graph.yml`. */
  dest: string;
  /**
   * Which vertex type to draw, when a corpus carries more than one.
   *
   * Defaults to the first the manifest names. A corpus of one type never passes it; a corpus of
   * several has to, because *which graph do you mean* is not a question a reader can answer.
   */
  vertexType?: string;
  /**
   * Read the identity column as well. **Off by default, and the same trade as everywhere else:**
   * `subject` costs about twice the drawing tile, so the drawing path carries addresses and a host
   * asks for names when something has to be *named* rather than painted.
   */
  subjects?: boolean;
}

/** One tile's bounding box, from the footer. `null` for a tile whose statistics are missing. */
interface TileBox {
  tile: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * The manifests, flat enough to read with a line scan.
 *
 * A YAML library would be a dependency for six keys, and fossil's own checker makes the same call —
 * sixty lines that refuse what they cannot parse rather than guessing at it. This does the same: a
 * key it cannot find is an error naming the file, not a default that draws an empty graph.
 */
function scalar(yaml: string, key: string): string | undefined {
  const line = yaml.split("\n").find((row) => row.startsWith(`${key}:`));
  return line?.slice(key.length + 1).trim().replace(/^['"]|['"]$/g, "");
}

function listItems(yaml: string, key: string): string[] {
  const rows = yaml.split("\n");
  const at = rows.findIndex((row) => row.startsWith(`${key}:`));
  if (at < 0) return [];
  const items: string[] = [];
  for (const row of rows.slice(at + 1)) {
    if (!row.startsWith("- ")) break;
    items.push(row.slice(2).trim());
  }
  return items;
}

async function manifest(dest: string, path: string): Promise<string> {
  const response = await fetch(`${dest}/${path}`);
  if (!response.ok) throw new Error(`corpus: ${path} is not readable (${response.status})`);
  return response.text();
}

/**
 * An opened corpus: the half that **draws** and the half that **answers**.
 *
 * A host needs both over the same bytes and they are not the same access. The canvas reads tiles by
 * address — a handful of files per camera move, chosen from the footer's boxes, with no query. A
 * chart, a crossfilter clause or a verb reads the *relation*: every row, by column name, in SQL.
 * Hiding the URLs behind `source` is right for the first and leaves the second with nothing to
 * query, so opening a corpus registers views for it.
 *
 * This is the other side's own shape. `fossil-mcp` describes itself as opening a dataset,
 * *registering views over the Parquet the corpus already holds*, and dispatching a verb — the same
 * two halves, named the same way, one call apart.
 */
export interface OpenedCorpus {
  /** For the canvas: `<GraphCanvas source={…}>`. Reads tiles, never the whole relation. */
  source: CorpusSource;
  /**
   * The vertex relation, registered and ready to query by name.
   *
   * Every column the manifest declares, including the corpus' own properties — so a clause a chart
   * publishes over `kind` or `region` lands here with no translation, which is what makes one
   * crossfilter serve the canvas and the charts.
   */
  nodes: string;
  /** The source-ordered edge relation, or `undefined` when the corpus declares no edge for this type. */
  edges: string | undefined;
}

/** What a corpus knows about itself beyond answering slices. */
export interface CorpusSource extends BoundedSource {
  /**
   * The rectangle the corpus occupies, from the boxes the footer already gave up.
   *
   * Free — nothing is read that a slice would not have read anyway — and it is what a host framing
   * an opening view wants. Not part of `BoundedSource` because a source over an unbounded or
   * unlaid-out relation has no answer to it.
   */
  extent(): Promise<Viewport>;
}

export async function openCorpus(options: OpenCorpusOptions): Promise<OpenedCorpus> {
  const { coordinator, dest, subjects = false, vertexType } = options;

  const root = await manifest(dest, "graph.graph.yml");
  const vertexPaths = listItems(root, "vertices");
  const edgePaths = listItems(root, "edges");

  const vertices = await Promise.all(vertexPaths.map((p) => manifest(dest, p)));
  const wanted =
    vertexType === undefined
      ? vertices[0]
      : vertices.find((y) => scalar(y, "type") === vertexType);
  if (!wanted) {
    throw new Error(
      `corpus: no vertex type ${vertexType ?? "(none declared)"} in ${dest}/graph.graph.yml`,
    );
  }

  const type = scalar(wanted, "type");
  const prefix = scalar(wanted, "prefix");
  const chunkSize = Number(scalar(wanted, "chunk_size"));
  if (!type || !prefix || !Number.isFinite(chunkSize) || chunkSize <= 0) {
    throw new Error(`corpus: ${dest} declares no usable type, prefix and chunk_size`);
  }

  // The edge relation whose source is this vertex type. Its tiles are keyed by the same range as the
  // vertices — `src_chunk_size` equals the source type's `chunk_size`, and a different number there
  // would address nothing — which is what lets one tile set serve both relations.
  const edges = await Promise.all(edgePaths.map((p) => manifest(dest, p)));
  const edge = edges.find((y) => scalar(y, "src_type") === type);
  const edgePrefix = edge ? scalar(edge, "prefix") : undefined;

  /**
   * The boxes, and the one query this source makes that is not a slice.
   *
   * Read on first use rather than in the factory: a host that constructs a source and never draws
   * should not pay for it, and the cost is a footer read over every tile. Kept forever after —
   * tiles are precomputed and their boxes cannot move without the corpus being rewritten.
   */
  let boxes: TileBox[] | null = null;
  let total: number | undefined;

  const tileUrl = (k: number) => `'${dest}/${prefix}chunk${k}.parquet'`;
  const edgeTileUrl = (k: number) => `'${dest}/${edgePrefix}by_source/tile${k}.parquet'`;

  async function load(): Promise<TileBox[]> {
    if (boxes) return boxes;
    /**
     * How many tiles there are, without listing anything.
     *
     * `ceil(V / chunk_size)` is the published arithmetic and it needs `V`, which **no manifest
     * carries** — the vertex YAML declares the type, the prefix and the chunk size and stops. So the
     * count has to come from the tiles themselves, and the obvious route is the one that does not
     * work: `read_parquet('…/chunk*.parquet')` expands a glob, expanding a glob lists a directory,
     * and a plain HTTP origin has no listing. It succeeds against a local path and against a bucket,
     * which is what makes the mistake easy to keep.
     *
     * So the last tile is found by probing — double until a `HEAD` misses, then bisect. That is
     * about a dozen requests once for a corpus of any size, and every one of them is a request a
     * plain origin can answer.
     */
    const exists = async (k: number) => (await fetch(`${dest}/${prefix}chunk${k}.parquet`, { method: "HEAD" })).ok;
    if (!(await exists(0))) throw new Error(`corpus: ${dest}/${prefix} holds no chunk0`);
    let low = 0;
    let high = 1;
    while (await exists(high)) {
      low = high;
      high *= 2;
    }
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (await exists(mid)) low = mid;
      else high = mid;
    }
    const tiles = low + 1;
    // The last tile is short unless the count divides evenly, and its footer says by how much —
    // metadata only, so this reads no column.
    const tail = await onceQuery(
      coordinator,
      () => `SELECT num_rows AS n FROM parquet_file_metadata('${tileUrl(low).slice(1, -1)}')`,
    );
    total = low * chunkSize + Number(numbers(tail, "n")[0] ?? 0);
    const urls = Array.from({ length: tiles }, (_, k) => tileUrl(k)).join(", ");
    /**
     * `min_value`/`max_value`, never `min`/`max`.
     *
     * Parquet's original statistics fields are defined by *signed* byte comparison, which is
     * meaningless for an unsigned column — a writer that gets this right leaves them empty. A reader
     * that only knows the deprecated pair concludes the footer carries no box for the column the
     * whole address is built on. `coalesce` keeps the float columns working either way.
     */
    const stats = await onceQuery(
      coordinator,
      () => `SELECT CAST(regexp_extract(file_name, 'chunk(\\d+)', 1) AS INTEGER) AS tile,
               min(CASE WHEN path_in_schema = 'x' THEN coalesce(stats_min_value, stats_min)::DOUBLE END) AS x0,
               max(CASE WHEN path_in_schema = 'x' THEN coalesce(stats_max_value, stats_max)::DOUBLE END) AS x1,
               min(CASE WHEN path_in_schema = 'y' THEN coalesce(stats_min_value, stats_min)::DOUBLE END) AS y0,
               max(CASE WHEN path_in_schema = 'y' THEN coalesce(stats_max_value, stats_max)::DOUBLE END) AS y1
             FROM parquet_metadata([${urls}])
             WHERE path_in_schema IN ('x', 'y') GROUP BY 1 ORDER BY 1`,
    );
    const tile = numbers(stats, "tile");
    const [x0, x1, y0, y1] = ["x0", "x1", "y0", "y1"].map((f) => numbers(stats, f));
    boxes = tile.map((t, i) => ({
      tile: t as number,
      x0: x0?.[i] as number,
      x1: x1?.[i] as number,
      y0: y0?.[i] as number,
      y1: y1?.[i] as number,
    }));
    return boxes;
  }

  /** The tiles a rectangle touches. Pure — this is the whole of the addressing, and it makes no call. */
  function intersecting(all: TileBox[], view: Viewport): number[] {
    return all
      .filter((b) => b.x1 >= view.xMin && b.x0 <= view.xMax && b.y1 >= view.yMin && b.y0 <= view.yMax)
      .map((b) => b.tile);
  }

  /**
   * Everything the corpus fixes, and nothing it does not.
   *
   * `dense_id`, `subject`, `x` and `y` are facts of the format — a corpus has them under those
   * names or it is not one. What colours and what sizes are channels, so they arrive with the
   * request and are filled in per slice.
   */
  const fixed = {
    id: "dense_id",
    subject: subjects ? "subject" : undefined,
    x: "x",
    y: "y",
    source: "src_dense",
    target: "dst_dense",
  } as const;

  /**
   * The relation half, registered once at open.
   *
   * A view rather than a table: `CREATE TABLE AS` would pull the corpus into memory, which is the
   * working set the whole bounded path exists to refuse. A view leaves the bytes where they are and
   * lets each query fetch the ranges it needs.
   *
   * Over **every** tile, deliberately — this is the surface that answers *what does it mean*, and a
   * count, a histogram or a crossfilter clause is a question about the corpus rather than about the
   * window. The addressed reading is `slice`, beside it, and the two are different access to the
   * same bytes rather than two versions of one.
   */
  const nodesView = `corpus_${type}`;
  const edgesView = edgePrefix ? `corpus_${type}_edges` : undefined;
  const allTiles = async () => {
    const boxes = await load();
    return boxes.map((b) => tileUrl(b.tile)).join(", ");
  };
  await coordinator.exec(
    `CREATE OR REPLACE VIEW ${nodesView} AS SELECT * FROM read_parquet([${await allTiles()}])`,
  );
  if (edgesView) {
    await coordinator.exec(
      `CREATE OR REPLACE VIEW ${edgesView} AS
         SELECT * FROM read_parquet('${dest}/${edgePrefix}by_source.parquet')`,
    );
  }

  const source: CorpusSource = {
    async total() {
      await load();
      return total ?? 0;
    },

    async extent() {
      const all = await load();
      return {
        xMin: Math.min(...all.map((b) => b.x0)),
        yMin: Math.min(...all.map((b) => b.y0)),
        xMax: Math.max(...all.map((b) => b.x1)),
        yMax: Math.max(...all.map((b) => b.y1)),
        // Above any threshold: an extent is asked for to frame a view, never to aggregate one.
        zoom: Number.POSITIVE_INFINITY,
      };
    },

    // Regions only, said the same way `duckBoundedSource` says it: no `explore`. A neighbourhood
    // needs adjacency this source does not index, and fossil's `expand` is what answers it —
    // `ExploringSource` is the shape waiting for whoever writes that one.
    async slice(request: SliceRequest): Promise<Slice> {
      const { fill = "community", limit, lodThreshold, pinned, r, view } = request;
      const columns: Columns = { ...fixed, category: fill, size: r };
      const all = await load();
      // Zoomed out past the threshold every tile is in the picture anyway, so aggregate reads the
      // whole set rather than selecting one it would only end up selecting all of.
      const selected =
        view.zoom < lodThreshold ? all.map((b) => b.tile) : intersecting(all, view);
      const nodes = `read_parquet([${selected.map(tileUrl).join(", ")}])`;
      const relation = `read_parquet([${(edgePrefix ? selected : []).map(edgeTileUrl).join(", ")}])`;

      // Nothing selected is a legitimate answer — the camera is over empty space — and asking
      // `read_parquet([])` is a syntax error rather than an empty result.
      if (selected.length === 0) {
        return {
          mode: "detail",
          n: 0,
          vertices: new BigUint64Array(0),
          positions: new Float32Array(0),
          links: new Float32Array(0),
          categories: new Uint16Array(0),
        };
      }

      return view.zoom < lodThreshold
        ? aggregate(coordinator, nodes, relation, columns, limit)
        : detail(coordinator, nodes, relation, columns, view, limit, 0, pinned);
    },
  };

  return { source, nodes: nodesView, edges: edgesView };
}
