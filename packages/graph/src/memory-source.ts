import {
  type BoundedSource,
  type Slice,
  type SliceRequest,
  type Viewport,
} from "./bounded";
import { vertexId, SUPERNODE, type VertexId } from "./resident";

/**
 * The trivial source: a host that already holds its arrays.
 *
 * ADR-0001 deletes `load()`, which means every consumer needs a source — including the ones for
 * which bounding buys nothing, because their graph fits. This is that source, and it exists so that
 * "wrap your arrays" is one import rather than a hundred lines each call site writes differently.
 *
 * It is also the only source we ship that answers **both** questions. A rectangle is a map question
 * and a relation with a spatial predicate can answer it; a neighbourhood is the graph question, and
 * answering it needs adjacency. Having the links in hand, this one does — so the bounded canvas is
 * an explorer here even while a SQL source leaves it a map.
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

export function memorySource(graph: MemoryGraph): BoundedSource {
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
    supports: () => true,
    slice(request: SliceRequest): Promise<Slice> {
      const { limit, lodThreshold, pinned, query } = request;
      if (query.kind === "neighbourhood") {
        return Promise.resolve(gather(graph, expand(query.seeds, query.depth), limit));
      }
      if (query.view.zoom < lodThreshold) return Promise.resolve(aggregate(graph, limit));
      return Promise.resolve(gather(graph, inside(graph, query.view, pinned), limit));
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
 */
function gather(graph: MemoryGraph, chosen: number[], limit: number): Slice {
  const matched = chosen.length;
  const kept = chosen.length > limit ? chosen.slice(0, limit) : chosen;
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
    // An edge with one end off-slice has nowhere to land.
    if (src >= 0 && dst >= 0) links.push(src, dst);
  }

  return {
    mode: "detail",
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
 * Zoomed out far enough that individual points are not information: one super-node per category, at
 * its centroid, weighted by how many it stands for.
 */
function aggregate(graph: MemoryGraph, limit: number): Slice {
  const count = graph.positions.length / 2;
  const sums = new Map<number, { x: number; y: number; weight: number }>();
  for (let i = 0; i < count; i++) {
    const key = graph.categories?.[i] ?? 0;
    const bucket = sums.get(key) ?? { x: 0, y: 0, weight: 0 };
    bucket.x += graph.positions[i * 2] as number;
    bucket.y += graph.positions[i * 2 + 1] as number;
    bucket.weight += 1;
    sums.set(key, bucket);
  }

  const keys = [...sums.keys()].slice(0, limit);
  const n = keys.length;
  const vertices = new BigUint64Array(n);
  const positions = new Float32Array(n * 2);
  const categories = new Uint16Array(n);
  const weights = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const key = keys[i] as number;
    const bucket = sums.get(key) as { x: number; y: number; weight: number };
    // A super-node stands for a group and is not a vertex of the corpus, so it wears the reserved
    // type — otherwise group 3 and vertex 3 are the same identity, and a selection made zoomed out
    // survives the zoom in pointing at three arbitrary nodes.
    vertices[i] = vertexId(SUPERNODE, key);
    positions[i * 2] = bucket.x / bucket.weight;
    positions[i * 2 + 1] = bucket.y / bucket.weight;
    categories[i] = key;
    weights[i] = bucket.weight;
  }

  // Which groups touch, not how often — at this zoom the multiplicity is not a readable difference.
  const seen = new Set<number>();
  const links: number[] = [];
  const slot = new Map(keys.map((key, i) => [key, i]));
  for (let e = 0; e < graph.links.length; e += 2) {
    const src = slot.get(graph.categories?.[graph.links[e] as number] ?? 0);
    const dst = slot.get(graph.categories?.[graph.links[e + 1] as number] ?? 0);
    if (src === undefined || dst === undefined || src === dst) continue;
    const pair = src * n + dst;
    if (seen.has(pair)) continue;
    seen.add(pair);
    links.push(src, dst);
  }

  return {
    mode: "aggregate",
    n: count,
    vertices,
    positions,
    links: Float32Array.from(links),
    categories,
    weights,
  };
}
