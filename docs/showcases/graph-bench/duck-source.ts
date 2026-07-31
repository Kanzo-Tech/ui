"use client";

import { count, Query } from "@uwdata/mosaic-sql";
import { numbers, type Coordinator } from "@kanzo-tech/ui/analytics";
import { onceQuery, type BoundedSource, type Slice, type SliceRequest } from "@kanzo-tech/graph";

/**
 * A `BoundedSource` over two ordinary DuckDB relations — the consumer half of the bounded path.
 *
 * It lives here rather than in `@kanzo-tech/graph` because that is where we decided the wiring
 * belongs: the package defines the contract, a source implements it, and the call site joins them.
 * Nothing about this file is reusable enough to be a library yet, and one implementation is not
 * evidence that it would be.
 *
 * It is also not GraphAr. That matters: the point of the contract is that fossil's `viewport` verb
 * and this can both satisfy it, so the harness can measure *bounded versus unbounded* before anyone
 * commits to a storage layout. When the verb lands, it drops in here and the numbers stay
 * comparable.
 */

export interface DuckSourceOptions {
  coordinator: Coordinator;
  /** Columns: a dense `id`, `x`, `y`, `community`. */
  nodes: string;
  /** Columns: `source`, `target`, as ids of the node relation. */
  edges: string;
}

export function duckBoundedSource(options: DuckSourceOptions): BoundedSource {
  const { coordinator, edges, nodes } = options;

  return {
    async total() {
      const rows = await onceQuery(coordinator, () =>
        Query.from(nodes).select({ n: count() }),
      );
      return Number(numbers(rows, "n")[0] ?? 0);
    },

    async slice(request: SliceRequest): Promise<Slice> {
      const { limit, lodThreshold, view } = request;
      return view.zoom < lodThreshold
        ? aggregate(coordinator, nodes, edges, limit)
        : detail(coordinator, nodes, edges, view, limit);
    },
  };
}

/**
 * The re-indexing happens in SQL, and that is the whole trick.
 *
 * `row_number() - 1` over the visible set gives every returned point a position in the arrays about
 * to be built, so the edge query can join to it twice and hand back links that already speak in
 * those positions. No id→index map is constructed in JavaScript — which is the 148 ms `load()`
 * spends at 200,000 nodes, gone by construction rather than by optimisation.
 *
 * The `LIMIT` sits inside the CTE, so the numbering is over what survives it. Numbering first and
 * limiting after would hand out indices into an array that was never built.
 */
function visibleCte(nodes: string, bbox: string, limit: number): string {
  return `WITH vis AS (
    SELECT id, x, y,
           -- An ordinal, not the raw value: a category column is text as often as not, and
           -- Number of "c3" is NaN, which would quietly colour every point slot zero.
           (dense_rank() OVER (ORDER BY community) - 1)::INTEGER AS category,
           (row_number() OVER (ORDER BY id) - 1)::INTEGER AS local
    FROM ${nodes}
    WHERE ${bbox}
    LIMIT ${limit}
  )`;
}

async function detail(
  coordinator: Coordinator,
  nodes: string,
  edges: string,
  view: SliceRequest["view"],
  limit: number,
): Promise<Slice> {
  const bbox = `x BETWEEN ${view.xMin} AND ${view.xMax} AND y BETWEEN ${view.yMin} AND ${view.yMax}`;
  const cte = visibleCte(nodes, bbox, limit);

  /**
   * How many matched, separately from how many came back.
   *
   * Without it the view cannot tell a reader "there is more here than I am showing you", and a
   * truncated slice looks exactly like a complete one — which is the failure this whole branch has
   * been about.
   */
  const [points, links, matched] = await Promise.all([
    onceQuery(coordinator, () => `${cte} SELECT local, x, y, category FROM vis ORDER BY local`),
    // Both endpoints must be visible: an edge with one end off-screen has nowhere to land.
    onceQuery(
      coordinator,
      () => `${cte}
        SELECT s.local AS src, t.local AS dst
        FROM ${edges} e
        JOIN vis s ON e.source = s.id
        JOIN vis t ON e.target = t.id`,
    ),
    onceQuery(coordinator, () => `SELECT count(*) AS n FROM ${nodes} WHERE ${bbox}`),
  ]);

  return {
    mode: "detail",
    n: Number(numbers(matched, "n")[0] ?? 0),
    ...arrays(points, links),
  };
}

/**
 * Zoomed out far enough that individual points are not information.
 *
 * One super-node per community, at its centroid, weighted by how many it stands for — so a view of
 * everything is a few thousand marks whatever the corpus. The aggregation is `GROUP BY` in DuckDB,
 * which means the bytes crossing into JavaScript are already the answer rather than the input to it.
 */
async function aggregate(
  coordinator: Coordinator,
  nodes: string,
  edges: string,
  limit: number,
): Promise<Slice> {
  const cte = `WITH vis AS (
    SELECT community, avg(x) AS x, avg(y) AS y, count(*) AS weight,
           (dense_rank() OVER (ORDER BY community) - 1)::INTEGER AS category,
           (row_number() OVER (ORDER BY community) - 1)::INTEGER AS local
    FROM ${nodes} GROUP BY community LIMIT ${limit}
  )`;

  const [points, links] = await Promise.all([
    onceQuery(
      coordinator,
      () => `${cte} SELECT local, x, y, category, weight FROM vis ORDER BY local`,
    ),
    // Edges between communities, deduplicated: at this zoom the question is which groups touch,
    // not how often.
    onceQuery(
      coordinator,
      () => `${cte}
        SELECT DISTINCT s.local AS src, t.local AS dst
        FROM ${edges} e
        JOIN ${nodes} sn ON e.source = sn.id
        JOIN ${nodes} tn ON e.target = tn.id
        JOIN vis s ON sn.community = s.community
        JOIN vis t ON tn.community = t.community
        WHERE s.local <> t.local`,
    ),
  ]);

  const built = arrays(points, links);
  const weights = Float32Array.from(numbers(points, "weight"));
  return { mode: "aggregate", n: weights.reduce((a, b) => a + b, 0), ...built, weights };
}

/** Arrow columns to the parallel typed arrays the renderer takes. */
function arrays(points: unknown, links: unknown): Omit<Slice, "mode" | "n" | "weights"> {
  const xs = numbers(points, "x");
  const ys = numbers(points, "y");
  const communities = numbers(points, "category");
  const positions = new Float32Array(xs.length * 2);
  const categories = new Uint16Array(xs.length);
  for (let i = 0; i < xs.length; i++) {
    positions[i * 2] = xs[i] as number;
    positions[i * 2 + 1] = ys[i] as number;
    categories[i] = (communities[i] as number) || 0;
  }

  const src = numbers(links, "src");
  const dst = numbers(links, "dst");
  const edges = new Float32Array(src.length * 2);
  for (let e = 0; e < src.length; e++) {
    edges[e * 2] = src[e] as number;
    edges[e * 2 + 1] = dst[e] as number;
  }

  return { positions, links: edges, categories };
}
