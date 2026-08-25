/**
 * A graph you never hold all of.
 *
 * `load()` is the other kind: it reads a relation whole, turns it into typed arrays, and hands the
 * lot to the renderer. Measured, that costs 389 ms at 200,000 nodes and stops being viable somewhere
 * short of a million — the working set is N, so the ceiling is whatever N the machine can hold.
 *
 * This is the shape that has no such ceiling: something asks a bounded question — a rectangle, or a
 * neighbourhood a few hops wide — and the source answers with **at most `limit` points**. The
 * answer's size follows the question rather than the corpus. Moving re-asks. A window holding more
 * than `limit` is *sampled* rather than truncated, so a view of everything is still a few thousand
 * marks and they are still spread over everything — see `sampled` in `duck-source.ts`.
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
 * **Deliberately not a format.** A source is anything that can answer that question: Parquet
 * fetched by address, a plain relation with `x`/`y` columns and a spatial predicate, or an
 * in-memory index. This package renders; it does not learn a storage layout. The
 * wiring between a particular source and this contract belongs at the call site.
 *
 * **Dense indices, not database ids.** `links` refers to positions in `positions`, so a consumer
 * never pays for an id→index map — the 148 ms that mapping costs at 200,000 nodes is not optimised
 * here, it is designed away. Sources that already number their vertices densely (GraphAr's
 * `dense_id` does) hand this over for free.
 */

import type { VertexId } from "./resident";

/**
 * What the camera is looking at, in the graph's own coordinate space.
 *
 * A rectangle and nothing else. It carried a `zoom` for one reader — the level-of-detail threshold
 * a source compared it against to decide whether to answer with super-nodes — and that branch is
 * gone, so the field went with it rather than staying as a number every caller has to invent and
 * nothing reads.
 */
export interface Viewport {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

/**
 * One answer. Every array is parallel and indexed densely from zero.
 *
 * `n` is what *matched*, before `limit` cut it — the difference between the two is how a view says
 * "there is more here than I am showing you", which is the one honest thing a bounded renderer owes
 * its reader. When a window holds more than `limit`, what comes back is a **sample** of it rather
 * than its first `limit` rows; `n` reports the window either way.
 *
 * **A struct, and it used to be a tagged union.** `mode` picked between points and super-nodes and
 * only the second branch carried `weights`. Both are gone — see
 * `decisions/a-far-view-is-a-sample-not-a-summary.md` — and with one branch left a discriminant is a
 * field with one legal value.
 */
export interface Slice {
  n: number;
  /**
   * How many of `positions` are **marks** — points a reader can see. Everything past it is an
   * *anchor*.
   *
   * An anchor is a real vertex at its real coordinates that the window did not return: it is in the
   * buffers so that an edge leaving the window has somewhere to end. It is never drawn — `buffers`
   * gives it radius zero and alpha zero, and `residentOf` stops here, so nothing hovers, selects or
   * frames one.
   *
   * **Why the far end is the vertex rather than a point on the border.** A stub clipped to the
   * viewport carries the right direction and *lies about the distance*, and a reader cannot tell a
   * stub that ends 1.1 window-widths out from one that ends 47 — measured over all the far ends a
   * window loses, 20–22% are past four semi-widths and the worst is 47.1
   * (`.planning/FAR-VIEW-AND-EDGES.md`). Drawing the vertex where it is cannot lie, and it is also
   * the cheaper of the two: a clipped stub is one point *per edge*, an anchor is one point per far
   * *vertex*.
   *
   * Equal to `positions.length / 2` for a source that answers with marks only, which is why it is
   * required rather than optional — a caller that reads it always gets the count it meant.
   */
  marks: number;
  /**
   * Who each returned point *is*, parallel to `positions` — the `(type_idx, dense_id)` pair packed
   * by `vertexId`.
   *
   * Present because a buffer index is **not stable across answers**: index 7 is a different vertex
   * after a pan. Anything that outlives one answer — a selection, a focused node, a pinned set — has
   * to be held as an identity and re-resolved through `residentOf` each time. Leaving this out was
   * how the first draft would have shipped a selection that silently pointed at the wrong nodes.
   *
   * `BigUint64Array` because the pair is 64 bits exactly — a `Uint32Array` cannot hold it at all,
   * and a `Float64Array` holds it only while the type index stays under 2²¹, which is a ceiling
   * nobody would find until they crossed it. Still a typed array, so it is still one allocation and
   * still transferable; only what it carries changed. A dense id on its own is not an identity: it
   * numbers within one vertex type, so a union of two types repeats every value.
   */
  vertices: BigUint64Array;
  /**
   * The subject IRI of each returned point, parallel to `vertices` — **opt-in, and absent by
   * default.**
   *
   * `vertices` says where a point *is*; this says which vertex it *is*. They are not the same thing
   * and the corpus is explicit about it: redoing a layout renumbers every vertex, so a `dense_id`
   * held outside the corpus names a different vertex after the next write. Anything that has to
   * survive a recompile — a bookmark, a link out, a row in somebody else's database — keys on the
   * IRI. A selection held as `VertexId` survives a pan and does not survive a rebuild.
   *
   * **Absent by default because it costs 1.87× the tile, measured on the corpus side.** Compressed
   * bytes per row at five million: `subject` 8.016 against `dense_id` 4.000, `x` 2.717, `y` 2.501.
   * The four drawing columns are 9.23 B/row and become 17.25 with it. So the drawing path carries
   * addresses, and a host asks for names when something has to be *named* rather than painted.
   *
   * A `string[]` rather than a typed array, because that is what an IRI is. It is the one thing in a
   * `Slice` that does not go to the GPU, which is exactly why it is optional: a host that never
   * names a vertex should not pay to move it.
   */
  subjects?: string[];
  /** `[x0, y0, x1, y1, …]`, one pair per returned point — `marks` of them, then the anchors. */
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
}

/**
 * A **region** is a map question: what is inside this rectangle. It suits an overview, a minimap, a
 * reader panning across a laid-out corpus, and it is what every source can answer.
 *
 * A **neighbourhood** is the graph question, and it lives on [`ExploringSource`] rather than here.
 * A network has no spatial "near"; it has topological near, and a rectangle cannot express "two hops
 * from this node" no matter how it is positioned. Leaving it out of the render contract was a real
 * design error — a contract that only spoke rectangles imposed a map metaphor on a network — and
 * putting it back as a *variant of the same call* was a second one, which is what this shape fixes.
 *
 * **The three ways a source used to say "not that question".** A member of a query union, a
 * `supports(kind)` predicate, and a `throw` at the top of `slice`. Three spellings of one idea, and
 * the only one a caller could act on before making the call was the middle one — so asking a
 * relational source for a neighbourhood was a runtime error that typechecked. It is a separate,
 * optional method now: a source that cannot walk edges does not have it, and asking is a compile
 * error rather than a promise that rejects.
 */
export interface SliceRequest {
  /** The rectangle. */
  view: Viewport;
  /**
   * Which column colours a point — Plot's channel name, and Plot's meaning.
   *
   * **On the request rather than on the source, and that is the whole shape.** A source says *where
   * the bytes are*; a request says *what I want to draw*, and which column colours is the second.
   * Baked into a source at construction — which is where it used to live — changing what a graph is
   * coloured by meant building a new source, and the two are not the same question.
   *
   * It is the reference's own arrangement: in Plot the **mark** carries the channels and the mark is
   * what produces the query, while the data source only says where rows come from.
   *
   * Defaults to `community`, which every corpus has because the layout pass writes it.
   */
  fill?: string;
  /**
   * Which column the size ramp is spent on — Plot's `r`.
   *
   * Omitted, every point is drawn at one radius, which is a legitimate picture: without a ramp a
   * look's `form.size` range has only one end.
   */
  r?: string;
  /**
   * Vertices that must come back whatever the query says.
   *
   * The set a reader has taken hold of — dragged, pinned, selected, focused. Their drawn positions
   * are a view-local overlay on coordinates that never move, so the index cannot find them where
   * they now appear. Carrying them explicitly is cheaper and more honest than making the index
   * mutable: it is a handful of identities, and the alternative is a spatial structure that has to be
   * rewritten every time somebody drags something.
   */
  pinned?: VertexId[];
  /**
   * The most points the source may return.
   *
   * **Above it a source samples the window; it does not take the front of it.** Which is the second
   * half of `n`'s honesty: `n` says how many matched, and this says the answer is a *sample* of
   * those rather than whichever ones an `ORDER BY` happened to put first.
   */
  limit: number;
  /**
   * How much of the graph's own space one screen pixel covers — the resolution the answer is going
   * to be looked at.
   *
   * **What it buys: an edge shorter than three pixels is not sent.** Two of every three edges a
   * five-million-node window draws are under one pixel long — they are a dot on top of their own
   * endpoints, which the point layer has already drawn. Discarding everything under 3 px sends
   * 27.5–35.3% of the rows and leaves 99.9–100% of the inked pixels identical
   * (`.planning/FAR-VIEW-AND-EDGES.md`, measured 2026-08-17).
   *
   * **A row discard, not a fade.** cosmos.gl's `linkVisibilityDistanceRange` already dims a short
   * link, and dimming happens after the row has been joined, returned, uploaded and rasterised. This
   * is the same picture without the work.
   *
   * The rectangle alone cannot say it: the same rectangle over a 400-pixel canvas and a 4,000-pixel
   * one are different questions, and only the caller knows which. Omitted — a source is asked for
   * everything, or by something with no canvas — nothing is discarded, because a threshold in pixels
   * with no pixels is not a threshold.
   */
  perPixel?: number;
  signal?: AbortSignal;
}

/**
 * Anything that can answer "what is in this rectangle, at this zoom, in at most this many marks".
 *
 * One method, one question. A source that also wants search, aggregation or paths is describing a
 * query surface rather than a render path, and there is already one of those — fossil's verbs. The
 * line: this answers *what should I draw*, and nothing about *what does it mean*.
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
  /**
   * The rectangle the corpus occupies, when the source can say cheaply.
   *
   * **Framing the opening view is not the host's job, and treating it as one is measured.** The
   * archive occupies `x ∈ [1843, 2253]` of a 4,096-wide space — 1% of its area — and a camera that
   * opens on the space rather than on the data draws 1,543 points into a tenth of the viewport, at
   * two to nine pixels each, under a fog of links. Every point is uploaded and none is legible, which
   * a reader reports as *the nodes are not rendering*.
   *
   * It matters more for a bounded source than for a whole one: the first question a sliced graph
   * asks is *what is the camera over*, so a camera pointing at empty space is a first paint of
   * nothing. Framing before asking is the difference between one query and none.
   *
   * Optional, because a source over an unlaid-out relation has no answer — and cheap where it
   * exists: a corpus reads it off tile footers it was going to read anyway, and a relation with
   * `x`/`y` gets it from four aggregates.
   */
  extent?(): Promise<Viewport>;
  /**
   * Say when the answer changes for a reason the camera cannot see, and hold the source's resources
   * for as long as anybody is listening.
   *
   * **A whole slice rather than a nudge to ask again, and that is what makes it worth having.** The
   * reason a bounded answer changes on its own is that the page filtered something — somebody
   * brushed a histogram, a panel picked a value — and a source that lives inside a crossfilter is
   * *told* by the coordinator, which has already re-run the reads with the new predicate by the time
   * this fires. Asking again would issue the same two queries a second time to learn what is in hand.
   *
   * The returned function is also the release: it is where a source lets go of whatever it holds —
   * a client registration, a connection, a cache — so a loop that calls this is a loop that cannot
   * leak one. Optional, because a source over arrays holds nothing and changes for nothing.
   */
  watch?(answered: (slice: Slice) => void): () => void;
}

/**
 * What a superseded question rejects with.
 *
 * A source may answer one question at a time — a shared connection, one client, one in-flight read —
 * so a camera that moves faster than the database answers leaves a promise with a caller awaiting
 * it. Dropping it leaves that caller's `finally` unrun and the loop reporting a query in flight for
 * the rest of the session, so it is *settled*, and this is what with.
 *
 * **A caller treats it as its own abort, never as a failure.** A sentinel rather than a message,
 * because "you moved on" and "the database said no" are the two things a query loop must tell apart,
 * and a string comparison against a thrown value goes stale with nothing failing.
 */
export const SUPERSEDED = Symbol("superseded");

export function isSuperseded(error: unknown): boolean {
  return error === SUPERSEDED;
}

/**
 * A source that can also be asked a topological question.
 *
 * Separate from [`BoundedSource`] rather than optional on it, because *can you walk edges* is a fact
 * about a source that a caller should learn from the type rather than from a predicate. A relation
 * with `x`/`y` and a spatial index answers regions and nothing else; one that holds adjacency — or
 * that can reach fossil's `expand` — answers both.
 *
 * `useQueryLoop` narrows with `"explore" in source`, which is the check a caller writes once.
 */
export interface ExploringSource extends BoundedSource {
  explore(request: ExploreRequest): Promise<Slice>;
}

/** Where to start and how far out. Everything else is the same bounding as a region. */
export interface ExploreRequest extends Omit<SliceRequest, "view"> {
  /** Where to start, as identities — not buffer indices, which do not survive an answer. */
  seeds: VertexId[];
  /** How many hops out. One is the ego network; beyond three is usually the whole graph. */
  depth: number;
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
 * from it. `useQueryLoop` asks the renderer instead.
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
  /**
   * The shortest edge worth a row — three screen pixels.
   *
   * Measured over the drawn edges of five windows per corpus, 2026-08-17: the median edge is 1.60 px
   * at 200k, 1.47 at a million and **0.52 at five million**, where 64.6% are under one pixel. An edge
   * that short is a dot on top of two dots the point layer has already drawn. Discarding under 3 px
   * sends 27.5–35.3% of the rows and leaves 99.9–100% of the inked pixels identical — the working is
   * in `.planning/FAR-VIEW-AND-EDGES.md`.
   *
   * Three rather than two because both were measured against the same five windows of
   * `docs/public/bench/1000000`: 2 px sends 5.6–25.8% more rows, mean 19%, for the same 0.1% of
   * image. Not on `SliceRequest`, because there is one call site and a knob with one call site is a
   * knob nobody has an opinion about — it moves when a second reader disagrees with the measurement.
   */
  minLinkPixels: 3,
} as const;
