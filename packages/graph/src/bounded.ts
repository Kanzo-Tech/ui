/**
 * A graph you never hold all of.
 *
 * `load()` is the other kind: it reads a relation whole, turns it into typed arrays, and hands the
 * lot to the renderer. Measured, that costs 389 ms at 200,000 nodes and stops being viable somewhere
 * short of a million — the working set is N, so the ceiling is whatever N the machine can hold.
 *
 * This is the shape that has no such ceiling: something asks a bounded question — a rectangle, or a
 * neighbourhood a few hops wide — and the source answers with **at most `limit` points**. The
 * answer's size follows the question rather than the corpus. Moving re-asks. Zooming out crosses a
 * threshold and the source answers with super-nodes instead of nodes, so a view of everything is
 * still a few thousand marks.
 *
 * **Where the layout comes from, and why it is not settled here.** These positions are precomputed:
 * a corpus too big to hold is a corpus too big to lay out live, so the coordinates arrive as data.
 * That leaves a seam worth naming rather than hiding — layout *quality* (how communities separate,
 * how much a graph breathes) is a visual judgement, and precomputing it puts that judgement in a
 * batch job upstream. It also breaks under filtering: a subset keeps coordinates computed for the
 * whole, so it reads as scattered with holes where its neighbours used to be.
 *
 * The resolution is available precisely because the path is bounded, and it is worth stating even
 * though nothing implements it yet: a slice is at most `limit` points, and the engine layer measures
 * 20,000 points at about 10 ms a simulation step. **A slice is small enough to re-lay-out live.** So
 * the precomputed coordinates are a map — they say roughly where things are, and which slice you are
 * looking at — while what is on screen can settle under real forces. The two do not compete.
 *
 * **Deliberately not a format.** A source is anything that can answer that question: GraphAr over
 * Parquet through fossil's `viewport` verb, a plain relation with `x`/`y` columns and a spatial
 * predicate, or an in-memory index. This package renders; it does not learn a storage layout. The
 * wiring between a particular source and this contract belongs at the call site.
 *
 * **Dense indices, not database ids.** `links` refers to positions in `positions`, so a consumer
 * never pays for an id→index map — the 148 ms that mapping costs at 200,000 nodes is not optimised
 * here, it is designed away. Sources that already number their vertices densely (GraphAr's
 * `dense_id` does) hand this over for free.
 */

/** What the camera is looking at, in the graph's own coordinate space. */
export interface Viewport {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  /**
   * Current zoom. Below `lodThreshold` a source is expected to answer with aggregates: the reader
   * is looking at everything, and everything is not a picture of anything.
   */
  zoom: number;
}

/**
 * The two ways of asking for part of a graph, and they are not variants of each other.
 *
 * A **region** is a map question: what is inside this rectangle. It suits an overview, a minimap, a
 * reader panning across a laid-out corpus.
 *
 * A **neighbourhood** is the graph question, and the first draft of this contract did not have it —
 * which was a real design error rather than a missing convenience. A network has no spatial "near";
 * it has topological near. Real exploration starts somewhere and expands outward, and a rectangle
 * cannot express "two hops from this node" no matter how it is positioned. fossil's verb surface has
 * had `find_neighbors` beside `viewport` all along; a render contract that only spoke rectangles was
 * imposing a map metaphor on a network.
 *
 * A source implements what it can. One that only lays out spatially answers regions; one over a
 * graph store answers both.
 */
export type SliceQuery =
  | { kind: "region"; view: Viewport }
  | {
      kind: "neighbourhood";
      /** Where to start, as source ids — not slice indices, which do not survive a slice. */
      seeds: number[];
      /** How many hops out. One is the ego network; beyond three is usually the whole graph. */
      depth: number;
    };

export type SliceMode = "detail" | "aggregate";

/**
 * One answer. Every array is parallel and indexed densely from zero.
 *
 * `n` is what *matched*, before `limit` cut it — the difference between the two is how a view says
 * "there is more here than I am showing you", which is the one honest thing a bounded renderer owes
 * its reader.
 */
export interface Slice {
  mode: SliceMode;
  n: number;
  /**
   * The source's own id per returned point, parallel to `positions`.
   *
   * Present because slice indices are **not stable across slices**: index 7 is a different node
   * after a pan. Anything that outlives one slice — a selection, a focused node, a pinned set —
   * has to be held as ids and re-resolved each time. Leaving this out was how the first draft would
   * have shipped a selection that silently pointed at the wrong nodes.
   */
  ids: Uint32Array;
  /** `[x0, y0, x1, y1, …]`, one pair per returned point. */
  positions: Float32Array;
  /** `[src, dst, …]` as indices into `positions`. */
  links: Float32Array;
  /** Per-point category ordinal, for colour. */
  categories: Uint16Array;
  /**
   * Aggregate mode only: how many real vertices each super-node stands for. A renderer can size a
   * mark by it, and a reader can tell a cluster of ten thousand from a cluster of three.
   */
  weights?: Float32Array;
}

export interface SliceRequest {
  query: SliceQuery;
  /** The most points the source may return. Above it, the source aggregates or truncates. */
  limit: number;
  /** Zoom below which a region query should switch to aggregate mode. Ignored by neighbourhoods. */
  lodThreshold: number;
  signal?: AbortSignal;
}

/**
 * Anything that can answer "what is in this rectangle, at this zoom, in at most this many marks".
 *
 * One method, two questions. A source that also wants search, aggregation or paths is describing a
 * query surface rather than a render path, and there is already one of those — fossil's fourteen
 * verbs. The line: this answers *what should I draw*, and nothing about *what does it mean*.
 *
 * `supports` exists because not every source can answer both. A relation with `x`/`y` and a spatial
 * index answers regions; asking it for a neighbourhood should be a typed refusal rather than a
 * silently wrong rectangle.
 */
export interface BoundedSource {
  slice(request: SliceRequest): Promise<Slice>;
  /** Which query kinds this source can answer. */
  supports(kind: SliceQuery["kind"]): boolean;
  /**
   * How many vertices there are in total, if the source knows cheaply.
   *
   * The reason this exists is the one real cost of bounding: **a graph that fits pays for nothing.**
   * Unbounded loads once and then pans on the GPU for free; bounded issues a query per camera move.
   * At 200,000 nodes that trade is overwhelmingly worth it — 1,017 ms of first paint against roughly
   * 130 ms — but at 2,000 it is pure loss, tens of milliseconds of latency per pan buying a ceiling
   * nobody was near.
   *
   * So a consumer asks first. Under the limit, take one slice covering everything and never ask
   * again: same code path, and panning is free exactly when it can be.
   */
  total?(): Promise<number>;
}

/**
 * Whether this graph should be sliced at all.
 *
 * `undefined` when the source cannot say cheaply — in which case slice, because an unknown corpus is
 * more likely to be the large kind than not.
 */
export function shouldSlice(total: number | undefined, limit: number): boolean {
  return total === undefined || total > limit;
}

/** Sensible defaults, and the reason each one is that number. */
export const BOUNDED_DEFAULTS = {
  /**
   * Twenty thousand marks.
   *
   * Above about 50,000 points a live layout stops being comfortable and the edge layer is already
   * fog well before that, so a limit far below the renderer's ceiling is not a compromise — it is
   * the legibility ceiling, which arrives first and is the one a reader actually meets.
   */
  limit: 20_000,
  /** fossil's `viewport` uses 0.5; matching it means one number to reason about across the seam. */
  lodThreshold: 0.5,
} as const;

/**
 * The rectangle a cosmos.gl camera is currently over.
 *
 * Kept here rather than in the canvas because it is the one piece of glue every source needs and
 * none of them should write twice. `spaceSize` is the simulation box the positions live in.
 */
export function viewportOf(
  screen: { width: number; height: number },
  camera: { x: number; y: number; k: number },
  spaceSize: number,
): Viewport {
  const halfW = screen.width / (2 * camera.k);
  const halfH = screen.height / (2 * camera.k);
  return {
    xMin: Math.max(0, camera.x - halfW),
    yMin: Math.max(0, camera.y - halfH),
    xMax: Math.min(spaceSize, camera.x + halfW),
    yMax: Math.min(spaceSize, camera.y + halfH),
    zoom: camera.k,
  };
}
