import {
  type ExploreRequest,
  type ExploringSource,
  type Slice,
  type SliceRequest,
  type Viewport,
} from "./bounded";
import type { VertexId } from "./resident";

/**
 * The trivial source: a host that already holds its arrays.
 *
 * ADR-0001 deletes `load()`, which means every consumer needs a source — including the ones for
 * which bounding buys nothing, because their graph fits. This is that source, and it exists so that
 * "wrap your arrays" is one import rather than a hundred lines each call site writes differently.
 *
 * It is also the only source we ship that is an [`ExploringSource`]. A rectangle is a map question
 * and any relation with a spatial predicate can answer it; a neighbourhood is the graph question,
 * and answering it needs adjacency. Having the links in hand, this one does.
 *
 * Everything derived is built on first use and kept: a graph small enough to hold is small enough
 * that an adjacency list is cheap, but a host that only ever pans should not pay to build one.
 */

export interface MemoryGraph {
  /** Who each point is, parallel to the position pairs — `vertexId(type, dense)` per point. */
  vertices: BigUint64Array;
  /** `[x0, y0, x1, y1, …]`. */
  positions: Float32Array;
  /** `[src, dst, …]` as indices into `positions`. */
  links: Float32Array;
  /**
   * The subject IRI of each vertex, parallel to `vertices` — optional, and the same opt-in the SQL
   * source makes for the same reason: a host that never names a vertex should not carry the names.
   */
  subjects?: string[];
  categories?: Uint16Array;
  sizes?: Float32Array;
}

export function memorySource(graph: MemoryGraph): ExploringSource {
  const count = graph.positions.length / 2;

  /** Built on demand — a host that only pans never asks for either of these. */
  let byVertex: Map<bigint, number> | null = null;
  let adjacency: number[][] | null = null;

  const indexOf = (vertex: VertexId): number | undefined => {
    if (!byVertex) {
      byVertex = new Map();
      for (let i = 0; i < count; i++) byVertex.set(graph.vertices[i] as bigint, i);
    }
    return byVertex.get(vertex);
  };

  const neighbours = (index: number): number[] => {
    if (!adjacency) {
      adjacency = Array.from({ length: count }, () => [] as number[]);
      for (let e = 0; e < graph.links.length; e += 2) {
        const src = graph.links[e] as number;
        const dst = graph.links[e + 1] as number;
        adjacency[src]?.push(dst);
        adjacency[dst]?.push(src);
      }
    }
    return adjacency[index] ?? [];
  };

  return {
    total: () => Promise.resolve(count),
    // One pass over the array it is already holding, so the canvas frames the arrays rather than the
    // renderer's default box.
    extent: () => Promise.resolve(boundsOf(graph.positions)),
    slice(request: SliceRequest): Promise<Slice> {
      const { limit, pinned, view } = request;
      return Promise.resolve(gather(graph, inside(graph, view, pinned), limit));
    },
    // The only source we ship that has this at all: a rectangle needs a spatial predicate, which
    // every source has, and a neighbourhood needs adjacency, which only a host holding its own links
    // does. So the bounded canvas is an explorer here while a SQL source leaves it a map.
    explore(request: ExploreRequest): Promise<Slice> {
      return Promise.resolve(gather(graph, expand(request.seeds, request.depth), request.limit));
    },
  };

  /**
   * Breadth-first from the seeds, `depth` hops out. Seeds are identities; everything after is a
   * corpus index, which is this source's own numbering and not a slice's.
   */
  function expand(seeds: VertexId[], depth: number): number[] {
    const seen = new Set<number>();
    let frontier: number[] = [];
    for (const vertex of seeds) {
      const index = indexOf(vertex);
      if (index !== undefined && !seen.has(index)) {
        seen.add(index);
        frontier.push(index);
      }
    }
    for (let hop = 0; hop < depth && frontier.length > 0; hop++) {
      const next: number[] = [];
      for (const index of frontier) {
        for (const other of neighbours(index)) {
          if (seen.has(other)) continue;
          seen.add(other);
          next.push(other);
        }
      }
      frontier = next;
    }
    return [...seen];
  }

  /** Everything the rectangle holds, plus whatever the reader is holding on to. */
  function inside(data: MemoryGraph, view: Viewport, pinned: VertexId[] | undefined): number[] {
    const hit: number[] = [];
    for (let i = 0; i < count; i++) {
      const x = data.positions[i * 2] as number;
      const y = data.positions[i * 2 + 1] as number;
      if (x >= view.xMin && x <= view.xMax && y >= view.yMin && y <= view.yMax) hit.push(i);
    }
    if (!pinned?.length) return hit;
    const held = new Set(hit);
    for (const vertex of pinned) {
      const index = indexOf(vertex);
      if (index !== undefined) held.add(index);
    }
    return [...held];
  }
}

/**
 * Chosen indices to a slice: renumber, copy the geometry, keep the links both of whose ends survived.
 *
 * `n` is what matched before `limit` cut it, which is the one honest thing a bounded view owes its
 * reader — a truncated answer must not look like a complete one.
 *
 * **Over the limit it strides rather than taking the front**, which is the same rule the SQL sources
 * apply and for the same reason: the front of an ordering is a *region* of whatever that ordering
 * follows, so `chosen.slice(0, limit)` drew one corner of a window and called it the window.
 *
 * What this source cannot promise, and the SQL ones can: that the stride is **spatially**
 * stratified. A corpus numbers along the Morton curve so every `s`-th id is spread over the space;
 * here the order is whichever order the host built its arrays in, and nothing knows what that is. A
 * stride over an unknown order is at worst an arbitrary sample, where a prefix of an unknown order
 * is at worst an arbitrary *contiguous* sample — so this is never the worse of the two and is
 * sometimes much better.
 */
function gather(graph: MemoryGraph, chosen: number[], limit: number): Slice {
  const matched = chosen.length;
  const stride = Math.max(1, Math.ceil(matched / limit));
  const kept: number[] = [];
  for (let i = 0; i < chosen.length && kept.length < limit; i += stride) {
    kept.push(chosen[i] as number);
  }
  const n = kept.length;

  // Global index → position in this slice, `-1` for everything not in it. One pass over the corpus
  // rather than a Map: the arrays are already dense and an Int32Array of N is cheaper than N boxed
  // entries, which is the whole argument of this branch in miniature.
  const local = new Int32Array(graph.positions.length / 2).fill(-1);
  const vertices = new BigUint64Array(n);
  const positions = new Float32Array(n * 2);
  const categories = new Uint16Array(n);
  const sizes = graph.sizes ? new Float32Array(n) : undefined;
  const subjects = graph.subjects ? new Array<string>(n) : undefined;
  for (let i = 0; i < n; i++) {
    const from = kept[i] as number;
    local[from] = i;
    vertices[i] = graph.vertices[from] as bigint;
    if (subjects) subjects[i] = graph.subjects?.[from] ?? "";
    positions[i * 2] = graph.positions[from * 2] as number;
    positions[i * 2 + 1] = graph.positions[from * 2 + 1] as number;
    categories[i] = graph.categories?.[from] ?? 0;
    if (sizes) sizes[i] = graph.sizes?.[from] ?? 0;
  }

  const links: number[] = [];
  for (let e = 0; e < graph.links.length; e += 2) {
    const src = local[graph.links[e] as number] as number;
    const dst = local[graph.links[e + 1] as number] as number;
    // An edge with one end off-slice is dropped, and that is a **limit of this reader rather
    // than of the corpus.** It reads like an impossibility and is not: a corpus carries
    // `by_target.parquet`, the CSC half, precisely so that "an edge with one endpoint off screen"
    // can be answered — it is a second addressing pass, not a missing fact. What is true is
    // narrower: this slice has no position to draw the far end at, because the far end is not in
    // the answer. Drawing it needs a segment clipped to the viewport, which is a renderer decision
    // nobody has made, and the vertices to clip against, which is the CSC read nobody has written.
    if (src >= 0 && dst >= 0) links.push(src, dst);
  }

  return {
    n: matched,
    vertices,
    subjects,
    positions,
    links: Float32Array.from(links),
    categories,
    sizes,
  };
}

/**
 * The rectangle a set of interleaved positions occupies.
 *
 * Empty arrays answer a degenerate rectangle at the origin rather than `±Infinity`: a view framed on
 * nothing should sit somewhere, and the infinities would make the fit arithmetic produce `NaN`.
 */
function boundsOf(positions: Float32Array): Viewport {
  let xMin = Number.POSITIVE_INFINITY;
  let yMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < positions.length; i += 2) {
    const x = positions[i] as number;
    const y = positions[i + 1] as number;
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  if (!Number.isFinite(xMin)) return { xMin: 0, yMin: 0, xMax: 0, yMax: 0 };
  return { xMin, yMin, xMax, yMax };
}
