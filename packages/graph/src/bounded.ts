/**
 * A graph you never hold all of.
 *
 * `load()` is the other kind: it reads a relation whole, turns it into typed arrays, and hands the
 * lot to the renderer. Measured, that costs 389 ms at 200,000 nodes and stops being viable somewhere
 * short of a million — the working set is N, so the ceiling is whatever N the machine can hold.
 *
 * This is the shape that has no such ceiling: the camera asks for a rectangle, the source answers
 * with **at most `limit` points**, and the answer's size is bounded by the question rather than by
 * the corpus. Panning re-asks. Zooming out crosses a threshold and the source starts answering with
 * super-nodes instead of nodes, so a view of everything is still a few thousand marks.
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
  view: Viewport;
  /** The most points the source may return. Above it, the source aggregates or truncates. */
  limit: number;
  /** Zoom below which the source should switch to aggregate mode. */
  lodThreshold: number;
  signal?: AbortSignal;
}

/**
 * Anything that can answer "what is in this rectangle, at this zoom, in at most this many marks".
 *
 * One method on purpose. A source that also wants to expose search, neighbours or histograms is
 * describing a query surface, and there is already one of those — fossil's fourteen verbs. This is
 * the render path and nothing else.
 */
export interface BoundedSource {
  slice(request: SliceRequest): Promise<Slice>;
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
