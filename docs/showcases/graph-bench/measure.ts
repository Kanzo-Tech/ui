import { Graph } from "@cosmos.gl/graph";
import { hyperbolic, mesh, type Generated } from "./generate";

/**
 * The two questions this file answers, kept apart on purpose.
 *
 * **What does a simulation step cost?** — `stepCost`. Timed by running batches of `graph.step()`
 * and then reading positions back, because the readback is what forces the queued GPU work to
 * finish. Measuring frames instead would measure `requestAnimationFrame`: a display caps at 60 or
 * 120 Hz, so anything faster than the cap reports the cap and every size below the ceiling looks
 * identical. This is the method cosmos.gl uses on itself.
 *
 * **What does the picture cost?** — `frameRate`. The honest end-to-end number, rAF cap and all,
 * because that cap is the reader's experience. Only meaningful once `stepCost` says whether the
 * budget went on the simulation or on drawing.
 *
 * Both leave the graph they built destroyed. A benchmark that leaks a GPU context poisons the
 * sizes after it, and the failure looks like "large graphs are slow" rather than "we ran out".
 */

export type Shape = "hyperbolic" | "mesh";

export interface Sample {
  shape: Shape;
  pointCount: number;
  linkCount: number;
  /** Milliseconds to build the arrays on the CPU. */
  generateMs: number;
  /** Milliseconds to hand them to the renderer and get the first picture. */
  uploadMs: number;
  /** Mean milliseconds per simulation step, GPU work included. */
  stepMs: number;
  /**
   * Frames per second over a real rAF window, links drawn — or `null` when the tab was hidden and
   * the question had no answer. Never a number the harness made up.
   */
  fps: number | null;
  /** Present only when the run failed; every numeric field above is then meaningless. */
  failure?: string;
}

/**
 * A frame, or a timeout pretending to be one.
 *
 * `requestAnimationFrame` does not fire in a backgrounded tab — it does not fire *late*, it does
 * not fire at all — so a bare `await nextFrame()` is an unconditional hang the moment the window
 * loses focus. The first run of this harness hung exactly there, forever, having produced nothing
 * and still claiming to be measuring.
 *
 * The race makes every wait terminate. It does not make a hidden tab measurable: see `visible`.
 */
export const nextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    let settled = false;
    const done = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };
    requestAnimationFrame(done);
    setTimeout(done, FRAME_TIMEOUT);
  });

/** Long enough not to pre-empt a real frame on a slow display, short enough not to feel hung. */
const FRAME_TIMEOUT = 50;

/**
 * How long a device gets to come up before the size is called unreachable.
 *
 * Generous on purpose — at a million points the driver is allocating tens of megabytes of textures
 * and 500,000 took nearly four seconds just to upload — but finite, which is the whole point.
 */
const READY_TIMEOUT = 30_000;

/**
 * How long the frame-rate window runs.
 *
 * A duration, not a frame count: at a million points a single tick takes most of half a second, so
 * "sixty frames" would be half a minute at the top size and a blink at the bottom. Two seconds is
 * enough to see several ticks even when they are slow.
 */
const FPS_WINDOW = 2_000;

/**
 * Whether frame-rate is a question this page can answer right now.
 *
 * A hidden tab renders nothing, so counting frames there measures the timeout above and reports a
 * confident 20 fps for every graph regardless of size. cosmos.gl also drives its simulation from
 * rendered frames, so a hidden tab is not a slow benchmark — it is a stopped one. Anything that
 * cannot be measured is reported as unmeasured.
 */
export const visible = (): boolean => typeof document !== "undefined" && !document.hidden;

export const SPACE = 8192;

/**
 * The default sweep stops at 200,000, and the two sizes above it are opt-in.
 *
 * Not timidity — courtesy. Generating 500k and 1M is several seconds of blocking main-thread
 * JavaScript and hundreds of megabytes of typed arrays *per size*, on top of a GPU already running
 * a million-point simulation. It does not merely make the tab slow; it makes the whole machine
 * slow, which is a bad thing for a page to do to someone who clicked a button labelled "run".
 *
 * 200,000 is also where the interesting answer already is: the engine layer shows a live layout is
 * finished by then, so everything above it is confirming a ceiling rather than finding one.
 */
export const SIZES = [2_000, 10_000, 50_000, 200_000];

/** The two that hurt. Appended only when the reader asks for them by name. */
export const STRESS_SIZES = [500_000, 1_000_000];

export function generate(shape: Shape, pointCount: number): Generated {
  if (shape === "mesh") {
    const columns = Math.max(2, Math.round(Math.sqrt(pointCount)));
    return mesh({ columns, rows: Math.max(2, Math.round(pointCount / columns)), spaceSize: SPACE });
  }
  return hyperbolic({ pointCount, spaceSize: SPACE });
}

/**
 * A graph built off-screen, for measuring rather than for looking at.
 *
 * Off-screen and not hidden: `display: none` gives the canvas a zero-sized drawing buffer, and a
 * zero-sized buffer makes every draw free. The numbers would be excellent and false.
 */
function host(): HTMLDivElement {
  const element = document.createElement("div");
  element.style.cssText =
    "position:absolute;left:-99999px;top:0;width:1200px;height:800px;pointer-events:none;";
  document.body.appendChild(element);
  return element;
}

interface RunOptions {
  shape: Shape;
  pointCount: number;
  /** Steps timed, after the warm-up. */
  steps?: number;
  warmup?: number;
  /** Frames sampled for the rAF figure. */
  frames?: number;
  /** Asked between phases; a `true` answer abandons the run and tears the graph down. */
  cancelled?: () => boolean;
  /** Idle milliseconds after teardown, so the collector gets a window between big sizes. */
  settleMs?: number;
}

export async function measure(options: RunOptions): Promise<Sample> {
  const { pointCount, shape } = options;
  const steps = options.steps ?? 40;
  const warmup = options.warmup ?? 12;
  const frames = options.frames ?? 60;
  const cancelled = options.cancelled ?? (() => false);
  const settle = options.settleMs ?? 0;

  const base: Sample = {
    shape,
    pointCount,
    linkCount: 0,
    generateMs: 0,
    uploadMs: 0,
    stepMs: 0,
    fps: 0,
  };

  /**
   * Generation is inside the `try`, and that is the whole point of it being here.
   *
   * It was outside once. At a million points it allocates tens of megabytes of typed arrays, which
   * is exactly where a run dies — and a throw there escaped `measure` entirely, rejected the
   * caller's `await`, and left the sweep looking like it had *finished* five sizes in. A ceiling
   * that reports itself as a completed run is worse than no benchmark.
   */
  let data: Generated;
  const element = host();
  let graph: Graph | undefined;
  try {
    const startedGenerating = performance.now();
    data = generate(shape, pointCount);
    const generateMs = performance.now() - startedGenerating;
    base.linkCount = data.linkCount;
    base.pointCount = data.pointCount;
    base.generateMs = generateMs;
    if (cancelled()) return { ...base, failure: "cancelled" };

    graph = new Graph(element, {
      spaceSize: SPACE,
      enableSimulation: true,
      fitViewOnInit: false,
      renderLinks: true,
      pointDefaultSize: 2,
      attribution: "",
      // Alpha never reaches the floor, so every timed step does the full force pass. The cost does
      // not depend on alpha, but a simulation that ends mid-run would stop stepping and the mean
      // would silently include steps that did nothing.
      simulationDecay: 1e12,
      simulationGravity: 0.25,
      simulationRepulsion: 1,
    });
    // 3.0 initialises the device asynchronously, and every method before this resolves is queued
    // rather than run. Timing without the await would time the queueing.
    //
    // Bounded, because `ready` is a promise with no failure path: when the device cannot be
    // created it does not reject, it simply never settles, and one size that never settles hangs
    // the whole sweep on the row before the answer everyone came for. A ceiling that reports
    // itself is the point of this file; an unbounded await is a ceiling that reports nothing.
    const initialised = await Promise.race([
      graph.ready.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), READY_TIMEOUT)),
    ]);
    if (!initialised) {
      return {
        ...base,
        failure: `the GPU device never initialised at ${pointCount.toLocaleString("en-US")} points (waited ${READY_TIMEOUT / 1000}s)`,
      };
    }
    if (cancelled()) return { ...base, failure: "cancelled" };

    const startedUploading = performance.now();
    graph.setPointPositions(data.positions);
    graph.setLinks(data.links);
    graph.render();
    // `render()` returns before the GPU has done any of it. The readback is the barrier.
    graph.getPointPositions();
    const uploadMs = performance.now() - startedUploading;
    if (cancelled()) return { ...base, uploadMs, failure: "cancelled" };

    // Stop the internal loop so it does not compete with the manual stepping below. Private in the
    // types, present at runtime — cosmos.gl's own benchmark reaches for it the same way.
    const stopFrames = (): void =>
      (graph as unknown as { stopFrames: () => void }).stopFrames();
    graph.start(1);
    stopFrames();

    // Positions are uploaded asynchronously. Stepping before they land would time no-ops and
    // report a spectacular ~0 ms, so wait for them and say so if they never arrive.
    let readable = false;
    for (let attempt = 0; attempt < 120 && !readable; attempt++) {
      readable = graph.getPointPositions().length > 0;
      if (!readable) await nextFrame();
      if (cancelled()) return { ...base, uploadMs, failure: "cancelled" };
    }
    if (!readable) {
      return { ...base, uploadMs, failure: `positions never became readable at ${pointCount}` };
    }

    for (let i = 0; i < warmup; i++) graph.step();
    graph.getPointPositions();

    const startedStepping = performance.now();
    for (let i = 0; i < steps; i++) graph.step();
    graph.getPointPositions();
    const stepMs = (performance.now() - startedStepping) / steps;
    if (cancelled()) return { ...base, uploadMs, stepMs, failure: "cancelled" };

    /**
     * Now the end-to-end rate — counted from the graph's own ticks, never from our waits.
     *
     * This was `for (i < frames) await nextFrame()` divided by the elapsed time, and it published
     * 60, 61, 62, 62, 61 and 52 fps for 2,000 through 1,000,000 points. Flat at the refresh rate
     * across a range where the step cost grows 300-fold, which is the shape of a number measuring
     * the display rather than the graph: `requestAnimationFrame` fires on the monitor's schedule
     * whether or not cosmos.gl did anything in between.
     *
     * `onSimulationTick` fires once per frame the renderer actually advanced, so counting those
     * over a wall-clock window is the rate the picture moves at. A graph too heavy to tick will
     * report a small number instead of the monitor's.
     */
    if (!visible()) return { ...base, uploadMs, stepMs, fps: null };
    let ticks = 0;
    graph.setConfigPartial({ onSimulationTick: () => void ticks++ });
    graph.start(1);
    const startedDrawing = performance.now();
    const deadline = startedDrawing + FPS_WINDOW;
    while (performance.now() < deadline) await nextFrame();
    const elapsed = performance.now() - startedDrawing;
    graph.setConfigPartial({ onSimulationTick: undefined });
    // The tab can be backgrounded mid-window, which stops ticks entirely. Re-asked rather than
    // assumed, so a number is either real or absent.
    const fps = visible() ? ticks / (elapsed / 1000) : null;

    return { ...base, uploadMs, stepMs, fps };
  } catch (error) {
    return { ...base, failure: String(error) };
  } finally {
    graph?.destroy();
    element.remove();
    // One frame for the context to actually go away, so the next size starts from a clean device.
    await nextFrame();
    // And, at the big sizes, a moment of nothing. Tearing down half a gigabyte of typed arrays and
    // immediately allocating the next lot leaves the collector no window to run in, which is how a
    // sweep stops being slow for the tab and starts being slow for the machine.
    if (settle > 0) await new Promise((resolve) => setTimeout(resolve, settle));
  }
}
