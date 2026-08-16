"use client";

import { Graph } from "@cosmos.gl/graph";
import { type Coordinator, numbers } from "@kanzo-tech/ui/analytics";
import { BOUNDED_DEFAULTS, shouldSlice, type Slice } from "@kanzo-tech/graph";
import { boot } from "../workspace/duck";
import { corpusSource, onceQuery, type CorpusSource } from "@kanzo-tech/graph/duckdb";
// The offscreen element and the rectangle it defines are `measure.ts`'s, so the two harnesses draw
// into the same one. They had a copy each — identical to the character, which is the kind of
// duplicate that stays true right up until one of them is tuned.
import { CANVAS, host, nextFrame } from "./measure";

/**
 * What the bounded path costs — the claim the page exists to make, against cosmos.gl alone.
 *
 * Two numbers matter and they pull opposite ways.
 *
 * **First paint** should collapse, because the work stops scaling with the corpus and starts
 * scaling with the window. Holding the whole relation cost 1,225 ms at 200,000 nodes to show a
 * picture — the figure `BENCHMARKS.md` keeps as a record, since ADR-0001 deleted the path that
 * produced it — and this should pay for twenty thousand marks whatever N is.
 *
 * **Panning** should appear from nowhere. Unbounded loads once and then pans on the GPU for free;
 * bounded issues a query per camera move. That is the cost of the trade and the reason it is
 * measured rather than assumed — a bounded path that costs 200 ms a pan is not an improvement, it
 * is a different kind of unusable.
 *
 * **There is one fixture, and it is the compiled corpus.** There used to be a second that built the
 * graph in the tab and handed DuckDB two CSVs; it measured the same code over a worse fixture,
 * capped the sweep at what a tab can generate, and spent the main thread doing it. Keeping both
 * would have been keeping a slower way to learn the same thing.
 */

export interface BoundedSample {
  pointCount: number;
  /** Getting the relations queryable: parsing a CSV, or opening a Parquet footer. */
  ingestMs: number;
  /** `total()` — the question that decides whether to slice at all. */
  totalMs: number;
  /** Whether the corpus was big enough to need slicing. */
  sliced: boolean;
  /** The opening slice, from query to typed arrays. */
  firstSliceMs: number;
  /**
   * The same rectangle, asked of a source that also reads `subject`. **An absolute, and there is
   * deliberately no delta against `firstSliceMs`.**
   *
   * The corpus measures the identity column at 1.87× the drawing tile in compressed bytes on disk,
   * and the first version of this field tried to be the reader's half of that figure: subtract the
   * plain slice from the naming one and publish the difference. **The first sweep refuted it.** The
   * difference came out *negative* at two thousand and again at a million — naming apparently
   * cheaper than not naming — which is not a cost, it is a cache.
   *
   * The confound is DuckDB's own page cache and it cannot be dropped from a tab. The two queries
   * read overlapping bytes of the same chunk files, so whichever runs second reads them warm. The
   * `forget()` above clears Mosaic's result cache, which is keyed by SQL text and therefore does
   * nothing here: the two queries have different text and never shared an entry. Reordering does not
   * help either — it moves which side is flattered, not whether one is.
   *
   * So the honest publication is the absolute, beside `firstSliceMs`, with the reader told they
   * share a warm cache. An isolated A/B needs a cold engine per arm, which is a different harness.
   */
  namedSliceMs: number;
  /** How many IRIs that slice actually carried — a zero here means the column was not read. */
  named: number;
  /** Handing that slice to the renderer, flushed by a readback. */
  uploadMs: number;
  /** Mean of several slices at shifted viewports — the cost of moving the camera. */
  panMs: number;
  /**
   * Mean cost of one full redraw of the slice on screen, flushed by a readback.
   *
   * The renderer's own ceiling, and it is here to be *ruled out*. This path never draws more than
   * the limit, so the frame rate cannot follow N and the question "how do we make it smoother" has
   * to be answered somewhere else — `panMs` is where. Measuring only one of the two would let a
   * display-capped 60 fps stand in for an experience that updates ten times a second.
   */
  drawMs: number;
  /** Points the opening slice actually returned. */
  returned: number;
  /** Points that matched it, before the limit. The gap is what the view is not showing. */
  matched: number;
  /**
   * DuckDB's thread count, so the row says which machine it is describing.
   *
   * `1` means the page was not cross-origin isolated and DuckDB-WASM took the single-threaded
   * bundle regardless of the cores available. Without it two runs of this table are not comparable.
   */
  threads: number;
  failure?: string;
}

/**
 * Every size that has a corpus on disk.
 *
 * A million is in the list because reading one that fossil already wrote costs a Parquet footer,
 * where building one in the tab is 8.6 s of main-thread JavaScript before DuckDB sees a byte. That
 * is the whole reason the fixture is compiled.
 */
export const BOUNDED_SIZES = [2_000, 10_000, 50_000, 200_000, 1_000_000];

/**
 * The size that asks whether any of this keeps its shape, and it is opt-in for two reasons.
 *
 * It has to be **built first** — the corpora are compiler output and gitignored, so a sweep against
 * a size nobody wrote is four hundred megabytes of 404 and a row of failures. And at five million
 * the interesting term stops being the window: the edge join is the one part of a slice that scans
 * something proportional to the corpus with nothing to prune, so this is the size that says whether
 * "the working set is the window" survives contact with an edge list.
 *
 *   node docs/showcases/graph-bench/corpus/build-corpus.mjs --sizes 5000000
 */
export const BOUNDED_STRESS_SIZES = [5_000_000];

/**
 * Vertices a pan window holds, whatever the corpus is — the zoom, expressed as what fits on screen.
 *
 * Set to the slice limit, so the window asks for about as much as the path is willing to return. A
 * window that grew with N would make "does the pan stop growing with N" unanswerable.
 */
const PAN_NODES = BOUNDED_DEFAULTS.limit;

/**
 * What cosmos.gl is told its coordinate space is — and the one number here that does not match the
 * corpus it draws.
 *
 * It reads 8,192 because the generator's space is 8,192, and this file used to draw the generator's
 * output. It no longer does: fossil centres coordinates on the origin and scales them to N, so the
 * compiled corpus spans ±535 at two thousand and ±11,968 at a million, and the note at the opening
 * view below says so in as many words. Deliberately **not** unified with `measure.ts`'s `SPACE`,
 * which is a fact about the generator and would only make one wrong number look authoritative.
 *
 * Left as it is because changing it moves every recorded figure, and the simulation is off and the
 * view is fitted from the measured extent, so what it costs is not visible in the timings. It is an
 * open item, not a resolved one — see BENCHMARKS.md before trusting a *picture* from this harness.
 */
const RENDER_SPACE = 8_192;
const PANS = 6;
const DRAWS = 30;
const DRAW_WARMUP = 5;

/**
 * Throw away what the last run remembered, or measure the memory instead of the graph.
 *
 * Mosaic caches results **by SQL text**, and a repeated sweep asks the identical questions — same
 * view names, same rectangle, same limit. The second run of this page reported 60–71 ms of first
 * paint at every size including a million, flat and beautiful and entirely a cache. Only the cache
 * goes: the clients are the harness's own and disconnecting them mid-sweep would strand a slice.
 *
 * This is the third time this benchmark has measured its own scaffolding — after a frame counter
 * that counted its own `await` and a layer 2 that ran the 2,000-node graph at every size. The
 * pattern is always the same and so is the defence: check the number against something that must
 * change with N, and disbelieve a flat line until it survives a cold start.
 */
async function forget(coordinator: Coordinator): Promise<void> {
  coordinator.clear({ cache: true, clients: false });
}

/**
 * How many cores DuckDB actually has, which is part of the measurement and not trivia.
 *
 * `selectBundle` picks the threaded `coi` build only when the document is cross-origin isolated;
 * otherwise DuckDB-WASM runs single-threaded however many cores the machine has. A page reporting
 * "220 ms at a million" without saying which of those two it was is not reproducible, so the number
 * rides along with the samples rather than living in someone's memory of how the server was
 * configured that afternoon.
 *
 * Asked once. It cannot change without a reload, and asking per size would put a query in front of
 * every measurement to learn something already known.
 */
let threadsAsked: Promise<number> | null = null;
function duckThreads(coordinator: Coordinator): Promise<number> {
  threadsAsked ??= onceQuery(coordinator, () => "SELECT current_setting('threads') AS n")
    .then((rows) => Number(numbers(rows, "n")[0] ?? 0))
    .catch(() => 0);
  return threadsAsked;
}


/**
 * Does DuckDB-WASM answer two connections at once, or one after the other?
 *
 * `BENCHMARKS.md` twice called concurrent queries the largest single win on this list, reasoning
 * that a pan costs the *sum* of its three queries where it could cost the *max*. That arithmetic is
 * sound and the conclusion does not follow from it: `threads = 1` here, DuckDB-WASM lives in one
 * worker, and every query reaches it over one message port. If connections do not overlap, issuing
 * the three differently changes nothing and the lever is imaginary.
 *
 * So it is asked rather than assumed. One connection gets a query that cannot be folded away — a
 * sort, because `count(*) FROM range(n)` is answered from the cardinality and returns in 37 ms
 * having computed nothing, which is how the first version of this probe measured nothing at all —
 * and a second connection gets a trivial one in the same tick. **If the trivial query answers while
 * the sort is still running, connections overlap.** If it lands with the sort, they queue.
 *
 * No timer separates the two, deliberately: a background tab throttles `setTimeout` (the first
 * version asked for 100 ms and got 497), so the delay would have become part of the measurement.
 * Issuing both in one tick needs no clock to be honest.
 *
 * Kept rather than deleted after answering: it is two connections and forty lines, and the next
 * person to propose parallel queries should be able to re-run it instead of re-reasoning it.
 */
export async function probeConnectionOverlap(): Promise<{
  overlaps: boolean;
  slowMs: number;
  fastMs: number;
}> {
  const { db } = await boot();
  const handle = db as unknown as {
    connect(): Promise<{ query(sql: string): Promise<unknown>; close(): Promise<void> }>;
  };
  const [slowConn, fastConn] = await Promise.all([handle.connect(), handle.connect()]);
  const started = performance.now();

  const slow = slowConn
    .query("SELECT count(*) FROM (SELECT i FROM range(8000000) t(i) ORDER BY hash(i))")
    .then(() => performance.now() - started);
  const fast = fastConn.query("SELECT 1").then(() => performance.now() - started);

  const [slowMs, fastMs] = await Promise.all([slow, fast]);
  await Promise.all([slowConn.close(), fastConn.close()]);

  // Answering in a fraction of the sort's time is the whole question.
  return { overlaps: fastMs < slowMs / 2, slowMs, fastMs };
}

// Reachable from the console, because the question is asked by hand and rarely.
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).probeConnectionOverlap = probeConnectionOverlap;
}

/** The rectangle the corpus actually occupies — the camera's space, never rescaled on the way in. */
interface Extent {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

interface Fixtured {
  source: CorpusSource;
  /**
   * The same two relations, read with the identity column as well.
   *
   * A second source rather than a flag on the first, because the comparison is the point: the plain
   * one is what the drawing path uses, and this one is what a host pays when it needs to name what
   * it drew. Same coordinator, same views, one more column.
   */
  named: CorpusSource;
  extent: Extent;
  /** Half-width of a window holding [`PAN_NODES`] vertices — the camera's reach at a usable zoom. */
  panReach: number;
  ingestMs: number;
}

/**
 * The compiled fixture: point DuckDB at the GraphAr tree and never hold it.
 *
 * A **view**, not a table. `CREATE TABLE AS` would pull the whole corpus into WASM memory, which is
 * the working set ADR-0001 exists to refuse — at a million that is the 93 MB on disk plus whatever
 * DuckDB expands it to. A view leaves the bytes on the server and lets every slice fetch the ranges
 * it needs, which is what makes the bbox predicate a *read* strategy rather than a filter applied
 * after the fact.
 *
 * The column names are GraphAr's rather than ours: `dense_id` is the dense index the contract asks
 * for by another name, and the edge file speaks `src_dense`/`dst_dense` because it was written
 * already resolved. Nothing is renamed on the way in — the source takes the names it is given.
 */
async function corpus(pointCount: number, report?: (stage: string) => void): Promise<Fixtured> {
  const { coordinator } = await boot();
  await forget(coordinator);
  const base = `${window.location.origin}/bench/${pointCount}`;

  const started = performance.now();
  report?.("opening the corpus · manifest");

  /**
   * One argument: where the corpus is.
   *
   * Everything this used to derive by hand — the chunk count from a `chunk_size` copied out of
   * fossil, the `chunk{k}.parquet` naming, the edge directory, GraphAr's column names, and the
   * twenty-line note about why a glob cannot work over a plain HTTP origin — is `corpusSource`'s
   * now, read from the manifest rather than written down here. That constant went stale once and
   * silently read a fraction of the corpus, which is the whole argument for this move and is
   * `decisions/a-tile-is-an-address-not-a-verb.md`.
   */
  const source = await corpusSource({ coordinator, dest: base });
  const named = await corpusSource({ coordinator, dest: base, subjects: true });

  /**
   * The extent, from the boxes the source already holds. No scan.
   *
   * This used to be `min(x), max(x), min(y), max(y)` over the whole relation, labelled as the
   * fixture's own cost with a note that a real reader takes its space from the manifest. It still
   * does not come from the manifest — GraphAr declares no extent — but it does now come from the
   * row-group statistics an addressed reader reads anyway, which is the same answer for free.
   */
  report?.("opening the corpus · extent");
  const bounds = await source.extent();

  /**
   * How far the camera reaches at a zoom that shows [`PAN_NODES`] vertices.
   *
   * **This changed with the move to `corpusSource` and the number is not the old one.** It was the
   * exact Chebyshev radius around the centre holding `PAN_NODES` vertices — a sort over the whole
   * corpus — and the relation that query needed is exactly what the source now hides. What replaces
   * it is the area-proportional radius: the fraction of the extent whose area holds that share of a
   * uniformly dense corpus.
   *
   * The two agree only when density is uniform and this layout's is not, so **`panMs` before and
   * after this commit are not the same measurement.** Recorded rather than smoothed over, because
   * the pan window has already been corrected twice in this file's history and both times the
   * lesson was that a window redefined quietly makes a table that cannot be compared with itself.
   *
   * What survives the change is the property the measurement exists for: the window is sized by how
   * much it *holds* rather than as a fraction of a space that grows with N, so a pan that stops
   * growing with the corpus is still the question being asked.
   */
  report?.("opening the corpus · reach");
  const half = Math.max(bounds.xMax - bounds.xMin, bounds.yMax - bounds.yMin) / 2;
  const corpusTotal = (await source.total?.()) ?? pointCount;
  const panReach = half * Math.sqrt(PAN_NODES / Math.max(1, corpusTotal));
  const ingestMs = performance.now() - started;

  return { source, named, extent: bounds, panReach, ingestMs };
}

export interface BoundedOptions {
  pointCount: number;
  cancelled?: () => boolean;
  onStage?: (stage: string) => void;
}

export async function measureBounded(options: BoundedOptions): Promise<BoundedSample> {
  const { pointCount } = options;
  const cancelled = options.cancelled ?? (() => false);
  const report = options.onStage;

  const base: BoundedSample = {
    pointCount,
    ingestMs: 0,
    totalMs: 0,
    sliced: false,
    firstSliceMs: 0,
    namedSliceMs: 0,
    named: 0,
    uploadMs: 0,
    panMs: 0,
    drawMs: 0,
    threads: 0,
    returned: 0,
    matched: 0,
  };

  const element = host();
  let graph: Graph | undefined;
  try {
    report?.("opening the corpus");
    const fixtured = await corpus(pointCount, report);
    const { extent, source } = fixtured;
    base.ingestMs = fixtured.ingestMs;
    base.threads = await duckThreads((await boot()).coordinator);
    if (cancelled()) return { ...base, failure: "cancelled" };

    report?.("asking the total");
    const startedTotal = performance.now();
    const total = await source.total?.();
    base.totalMs = performance.now() - startedTotal;
    base.sliced = shouldSlice(total, BOUNDED_DEFAULTS.limit);

    /**
     * The corpus is the size its directory says, or the row is a failure rather than a fast number.
     *
     * This guarded a constant that no longer exists: `CHUNK_SIZE` lived here, went stale against
     * fossil, and silently derived too few chunk URLs — every one of which resolved, so the sweep
     * measured a fraction of the corpus at a flattering latency and reported no error at all.
     * `corpusSource` reads the chunk size from the manifest now, so that particular drift cannot
     * happen; the check stays because it costs one comparison against a number already timed, and
     * because *the reader found fewer vertices than the corpus holds* is the failure shape, not the
     * one cause that used to produce it.
     */
    if (total !== undefined && total !== pointCount) {
      return {
        ...base,
        failure: `the corpus at /bench/${pointCount} holds ${total} vertices, not ${pointCount}`,
      };
    }

    // The opening view: the whole space, at a zoom above the threshold so this measures detail mode
    // rather than the aggregate shortcut. Aggregate would flatter the numbers.
    //
    // The space is the corpus's own, asked rather than assumed. fossil writes coordinates centred on
    // the origin and scaled to N — ±535 at two thousand, ±11,968 at a million — so a rectangle nailed
    // to `0..SPACE` would have measured an empty corner at every size but one, and reported a very
    // fast first paint for showing nothing. (`RENDER_SPACE` above is the one place that did not get
    // this memo, and says so.)
    const view = { ...extent, zoom: 1 };

    report?.("first slice");
    const startedSlice = performance.now();
    const first: Slice = await source.slice({
      query: { kind: "region", view },
      limit: BOUNDED_DEFAULTS.limit,
      lodThreshold: BOUNDED_DEFAULTS.lodThreshold,
    });
    base.firstSliceMs = performance.now() - startedSlice;
    base.returned = first.positions.length / 2;
    base.matched = first.n;
    if (cancelled()) return { ...base, failure: "cancelled" };

    /**
     * The same question, of the source that also names.
     *
     * After the plain one and never before it: Mosaic caches by SQL text, and these two are
     * different texts, so neither warms the other. What would spoil it is asking this one first and
     * letting its scan warm DuckDB's own buffers for the second — hence this order, which puts the
     * cost of a cold read on the column the product actually uses.
     */
    report?.("naming the slice");
    const startedNamed = performance.now();
    const namedSlice: Slice = await fixtured.named.slice({
      query: { kind: "region", view },
      limit: BOUNDED_DEFAULTS.limit,
      lodThreshold: BOUNDED_DEFAULTS.lodThreshold,
    });
    base.namedSliceMs = performance.now() - startedNamed;
    base.named = namedSlice.subjects?.length ?? 0;
    if (cancelled()) return { ...base, failure: "cancelled" };

    report?.("uploading");
    graph = new Graph(element, {
      spaceSize: RENDER_SPACE,
      enableSimulation: false,
      fitViewOnInit: false,
      attribution: "",
    });
    const ready = await Promise.race([
      graph.ready.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 30_000)),
    ]);
    if (!ready) return { ...base, failure: "the GPU device never initialised" };

    const startedUpload = performance.now();
    graph.setPointPositions(first.positions);
    graph.setLinks(first.links);
    graph.render();
    graph.getPointPositions();
    base.uploadMs = performance.now() - startedUpload;
    if (cancelled()) return { ...base, failure: "cancelled" };

    /**
     * What it costs to draw what is already on screen.
     *
     * Timed the way layer 1 times a step — a batch of redraws flushed by one `getPointPositions()`
     * readback — and never by counting `requestAnimationFrame`, which reports the monitor's
     * schedule whether or not the renderer did anything. There is no simulation here to count ticks
     * from, so the readback is the only honest flush.
     */
    report?.("drawing");
    for (let i = 0; i < DRAW_WARMUP; i++) graph.render();
    graph.getPointPositions();
    const startedDrawing = performance.now();
    for (let i = 0; i < DRAWS; i++) graph.render();
    graph.getPointPositions();
    base.drawMs = (performance.now() - startedDrawing) / DRAWS;
    if (cancelled()) return { ...base, failure: "cancelled" };

    /**
     * Panning, measured as the reader would feel it.
     *
     * Six windows a quarter of the space wide, walked across the corpus — not six repeats of the
     * same rectangle, which DuckDB would answer from cache and which would report a latency nobody
     * experiences.
     *
     * **Shaped like the canvas, and sized by what it holds.** Two corrections, both of the same
     * kind: the window used to span the full height, which cuts across the Morton order the corpus
     * is written in, and it used to be a quarter of the *space*, which grows with N. Measured, the
     * strip needed 7 chunks of 9 against 4 for a canvas-shaped rectangle; and the fixed fraction
     * matched 62,112 rows at a million against 426,611 at five, so a pan measured that way could
     * only grow with the corpus whatever the engine did.
     *
     * Now it is a camera: [`PAN_NODES`] vertices on screen, in the element's aspect ratio, walked
     * across the corpus. The area comes from `panReach` — the radius that holds that many — and is
     * reshaped to the canvas without changing it.
     */
    report?.("panning");
    const startedPanning = performance.now();
    const span = extent.xMax - extent.xMin;
    const step = span / (PANS + 1);
    const aspect = Math.sqrt(CANVAS.width / CANVAS.height);
    const width = 2 * fixtured.panReach * aspect;
    const height = (2 * fixtured.panReach) / aspect;
    const midY = (extent.yMin + extent.yMax) / 2;
    for (let i = 0; i < PANS; i++) {
      const x = extent.xMin + step * (i + 1);
      await source.slice({
        query: {
          kind: "region",
          view: {
            xMin: x - width / 2,
            yMin: midY - height / 2,
            xMax: x + width / 2,
            yMax: midY + height / 2,
            zoom: 1,
          },
        },
        limit: BOUNDED_DEFAULTS.limit,
        lodThreshold: BOUNDED_DEFAULTS.lodThreshold,
      });
      if (cancelled()) return { ...base, failure: "cancelled" };
    }
    base.panMs = (performance.now() - startedPanning) / PANS;

    return base;
  } catch (error) {
    return { ...base, failure: String(error) };
  } finally {
    graph?.destroy();
    element.remove();
    await nextFrame();
  }
}
