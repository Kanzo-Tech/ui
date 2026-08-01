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
 * **Positions are authority, not suggestion.** The corpus is written once and read many — OLAP, which
 * is what GraphAr is for — so the coordinates the batch emits are the index every spatial question
 * is asked against. That settles a tension an earlier draft of this file waved at rather than
 * resolved: re-laying-out a slice live would move points out from under the very coordinates the
 * next query is expressed in, and the camera would drift away from the index within one frame of
 * the first force. **Do not re-lay-out a slice.** If a layout is wrong, it is wrong upstream, and it
 * is fixed by recompiling — the graph is a compiler's output and so is its geometry.
 *
 * **Dragging is the exception, and it is a local overlay.** A reader can move a node; that changes
 * where it is *drawn*, never where it is *indexed*. The consequence is small and real: drag a node
 * far away, pan to where you dropped it, and the spatial query does not know it is there. Which is
 * why `pinned` exists below — the few points a reader has taken hold of ride along with every
 * slice, regardless of the rectangle.
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
   * What the size ramp is spent on, per point — a degree, a count, whatever the corpus ranks by.
   *
   * Optional because a source may not have one, and a graph drawn at one radius is a legitimate
   * picture. But without it a look's `form.size` range has only one end, so a source that can afford
   * the column should send it: it is the difference between seeing a hub and counting one.
   */
  sizes?: Float32Array;
  /**
   * Aggregate mode only: how many real vertices each super-node stands for. A renderer can size a
   * mark by it, and a reader can tell a cluster of ten thousand from a cluster of three.
   */
  weights?: Float32Array;
}

export interface SliceRequest {
  query: SliceQuery;
  /**
   * Ids that must come back whatever the query says.
   *
   * The set a reader has taken hold of — dragged, pinned, selected, focused. Their drawn positions
   * are a view-local overlay on coordinates that never move, so the index cannot find them where
   * they now appear. Carrying them explicitly is cheaper and more honest than making the index
   * mutable: it is a handful of ids, and the alternative is a spatial structure that has to be
   * rewritten every time somebody drags something.
   */
  pinned?: number[];
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

/**
 * Sensible defaults, and the reason each one is that number.
 *
 * The camera→rectangle conversion that used to live here is gone: cosmos.gl owns the screen↔space
 * transform and answers it through `screenToSpacePosition`, so deriving the rectangle from the
 * camera and the space size was a second implementation of the renderer's own maths, free to drift
 * from it. `useBoundedGraph` asks the renderer instead.
 */
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
