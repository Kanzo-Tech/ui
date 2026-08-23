"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { Graph } from "@cosmos.gl/graph";
import { clusterRing } from "./cluster-ring";
import { forces } from "./graph-model";
import { DEFAULT_SIM, type Sim } from "./graph-sim";
import type { Motion } from "./types";
import { whenReady } from "./when-ready";

/**
 * The renderer's whole life: built once, told what the forces are, destroyed on the way out.
 *
 * **It no longer knows anything about the data**, and that is the change ADR-0001 forced rather than
 * a tidy-up. Construction used to depend on a `Loaded`, which was harmless when the data arrived
 * once; under a bounded path a slice arrives on every camera move, and a construction effect keyed
 * on it would tear down and rebuild a WebGL context per pan. Geometry is pushed in by
 * `useBoundedGraph`; the instance outlives every slice it draws.
 *
 * Everything about the picture — colours, sizes, shapes, the look, the camera, and since 3.0 even
 * whether a simulation runs at all — is a `setConfigPartial` somewhere else. **Three fields are
 * genuinely init-only**, and they are the three `preserveInitOnlyFields` restores after every config
 * write: `initialZoomLevel`, `randomSeed` and `attribution`.
 *
 * The callbacks are handed over exactly once, which is why every one of them reads the present
 * through a ref rather than a closure.
 */

/**
 * Whether this browser can run the renderer at all.
 *
 * Asked rather than inferred, because the failure is silent in both directions. cosmos.gl draws its
 * own English message into the host element rather than throwing, so the `try/catch` around the
 * constructor was catching a case that cannot reach it. Worse under 3.x: device creation is
 * asynchronous and `graph.ready` has **no failure path** — when the device cannot be made it does
 * not reject, it simply never settles, so a caller awaiting it waits forever with nothing on screen.
 *
 * So the probe stays, and it answers the common case before any of that can happen. The catch stays
 * for real construction faults.
 */
function hasWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const probe = document.createElement("canvas");
    return probe.getContext("webgl2") !== null || probe.getContext("webgl") !== null;
  } catch {
    return false;
  }
}

/**
 * **Give the WebGL context back, because cosmos.gl does not.**
 *
 * `destroy()` frees its own buffers and textures and leaves the context itself attached to the
 * canvas — `WEBGL_lose_context` and `loseContext` appear **zero times** in `@cosmos.gl/graph@3.4.0`.
 * A context released only by garbage collection is a context held for an unbounded time, and a
 * browser has a hard budget for them: Chrome keeps sixteen per renderer process and **evicts the
 * oldest** when a seventeenth is asked for. Eviction is not an error anywhere — the canvas simply
 * stops painting, `getPointPositions()` reads back empty, and `getZoomLevel()` answers zero.
 *
 * That is not a large-application problem. `/docs/graph` mounts four graphs, React's StrictMode runs
 * every effect setup → cleanup → setup, so eight contexts are created and four are orphaned on a
 * single page load — and three of the four canvases measured `isContextLost === true` while the
 * newest one drew. `/view/showcases/graph-bench` has one graph and has always looked fine, which is
 * how this survived: the bug is invisible until a page holds more than one.
 *
 * The extension is absent on some drivers and the context may already be lost, and neither is worth
 * reporting: this is a release, and a release that cannot happen has nothing to say.
 */
function releaseContext(canvas: HTMLCanvasElement | null): void {
  const gl = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl");
  if (gl && !gl.isContextLost()) gl.getExtension("WEBGL_lose_context")?.loseContext();
}

export interface CosmosGraphOptions {
  /** The element cosmos.gl mounts its canvas into. */
  hostRef: RefObject<HTMLDivElement | null>;
  /**
   * Where to put the instance.
   *
   * Given rather than returned, because the overlays, the gesture and the query loop all need a way
   * to reach the graph and this hook needs their callbacks — returning it would make the
   * declarations circular.
   */
  graphRef: RefObject<Graph | null>;
  /**
   * Whether to run a live layout, and it **defaults to off**.
   *
   * ADR-0001's premise: positions are authority. A bounded source hands back coordinates that the
   * next spatial query is expressed in, so a force that moves them moves the picture out from under
   * its own index — the camera drifts away from the corpus within a frame. Off is therefore the
   * correct default and not a conservative one.
   *
   * On is for the other host: arrays in hand, no precomputed layout, few enough points that a live
   * simulation is the cheapest way to get one. That host has no spatial index to disagree with.
   */
  simulate?: boolean;
  /**
   * Cluster assignment per drawn point, when a live layout should group them.
   *
   * Only meaningful under `simulate` — it is a force, not a colour. `undefined` at a position means
   * *no group*, which is not group zero: a vertex shared by every group belongs to none, and left
   * unclustered it drifts between the ones it joins.
   */
  clusters?: (number | undefined)[];
  /** Defaults to `DEFAULT_SIM`, which is the same table the exported constant carries. */
  sim?: Sim;
  /** Where to report what the layout is doing. Optional: a host with no motion badge wants none. */
  report?: (motion: Motion) => void;
  /**
   * How far through settling the layout is, `0`–`1`.
   *
   * cosmos.gl computes it every tick as `√(min(1, ALPHA_MIN / alpha))` and exposes it as
   * `graph.progress`, so a determinate badge costs nothing to compute — only to deliver. Quantised
   * before it is reported, because this is React state read through context and a write per
   * animation frame would re-render every consumer 60 times a second to move a number by half a
   * percent.
   */
  reportProgress?: (value: number) => void;
  onFailure: (message: string) => void;
  /**
   * Callbacks handed to cosmos.gl once, at construction — **all optional, and so is the block**.
   *
   * They were required, and a graph that only wants to be *looked at* had to write seven no-ops to
   * say so. A picture with no interaction is a legitimate picture, and the seven that report a
   * gesture nobody handles have exactly one sensible default. `onFailure` is the one that stays
   * required, deliberately: it is the only callback whose silence is a defect rather than a
   * choice — unhandled, a browser with no WebGL context shows an empty box and says nothing.
   */
  events?: {
    onPointerOver?: (index: number) => void;
    onPointerOut?: () => void;
    onPointClick?: (graph: Graph, index: number) => void;
    onBackgroundClick?: () => void;
    /**
     * A node has been let go of, by index.
     *
     * cosmos.gl does not say which one. Its drag subject is `{x, y}`, and `store.draggingPointIndex`
     * is cleared *before* `onDragEnd` is called — so the index is remembered from the hover that
     * made the drag possible in the first place: the drag behaviour's subject only answers while
     * `store.hoveredPoint` is set, and hover detection is skipped for the whole gesture.
     */
    onDragEnd?: (index: number) => void;
    onTick?: () => void;
    /** The camera moved. The query loop is wired here — this is how a bounded graph is asked again. */
    onZoom?: () => void;
  };
}

/**
 * The defaults for everything a picture-only host does not care about.
 *
 * Frozen module constants rather than object literals in the destructure: a fresh `{}` per render
 * would be a new identity for `live.current` and for `applied`, which is the class of bug the ref
 * indirection below exists to avoid in the first place.
 */
const noop = () => {};
const EMPTY_EVENTS: NonNullable<CosmosGraphOptions["events"]> = Object.freeze({});

export function useCosmosGraph(options: CosmosGraphOptions): void {
  const {
    clusters,
    events = EMPTY_EVENTS,
    graphRef,
    hostRef,
    onFailure,
    report = noop,
    reportProgress = noop,
    sim = DEFAULT_SIM,
    simulate = false,
  } = options;

  /**
   * The coefficients the graph is currently running with.
   *
   * The constructor takes them and the effect below re-applies them when they move — so this is not
   * a "first render" flag, it is the answer to *what does the simulation already have?*, which is
   * the question both places are asking.
   */
  const applied = useRef(sim);
  const live = useRef(events);
  live.current = events;

  /**
   * **The caller's callbacks, held rather than depended on.**
   *
   * `onFailure`, `report` and `reportProgress` used to sit in the construction effect's dependency
   * list, which made the renderer's lifetime a function of a caller's *render*. `onFailure` is
   * required by this package and every consumer writes it inline — `onFailure={(e) => setFailure(e)}`
   * is the obvious spelling — so every render was a new identity, and every new identity destroyed
   * the graph and built another.
   *
   * Measured on `/docs/graph`: **142 `destroy()` calls in five seconds** with nobody touching the
   * page, `setPointPositions` called **zero** times, and `getGraph()` answering a different instance
   * each time it was asked. Nothing painted, because no instance lived long enough to be given
   * geometry — and at roughly twenty-eight rebuilds a second it also burned the browser's
   * sixteen-context budget continuously, which is why the *other three* graphs on the page were
   * blank too. One example with an inline callback starved the page.
   *
   * A ref rather than `useCallback` at the call site: a rule that every consumer must memoise a
   * required callback is a rule nobody remembers, and its failure is silent.
   */
  const callbacks = useRef({ onFailure, report, reportProgress });
  callbacks.current = { onFailure, report, reportProgress };

  /**
   * Whether the camera has been put where the layout is.
   *
   * `fitViewOnInit` frames the graph at `fitViewDelay`, a second in, while a simulation is still
   * contracting — so by the time it converges the picture has shrunk to a blob in the middle of an
   * empty canvas. The early fit is still worth having, because a second of *something* beats a
   * second of nothing; it just is not the last word. This one is: once, and never again — re-framing
   * on later settles would yank the camera out from under whoever nudged a slider, and under a
   * bounded path it would fight the reader's own panning.
   */
  const framed = useRef(false);

  /** The last bucket handed on, so a tick that has not moved the badge costs nothing. */
  const reported = useRef(-1);
  const progress = useCallback((value: number) => {
    const bucket = Math.round(value * PROGRESS_STEPS);
    if (bucket === reported.current) return;
    reported.current = bucket;
    callbacks.current.reportProgress(bucket / PROGRESS_STEPS);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    framed.current = false;
    if (!hasWebGL()) {
      callbacks.current.onFailure("This canvas renders on the GPU, and this browser offers no WebGL context.");
      return;
    }

    /** Put the camera where the layout ended up — once, whoever gets here first. */
    const frameOnce = () => {
      if (framed.current) return;
      framed.current = true;
      const graph = graphRef.current;
      if (graph) whenReady(graph, (ready) => ready.fitView(FIT_DURATION, FIT_PADDING));
    };

    // Which node the pointer is on, and which one the current gesture picked up. Locals rather than
    // refs: they are read and written only by callbacks this closure owns, and they die with the
    // instance those callbacks belong to.
    let hovering: number | null = null;
    let dragging: number | null = null;

    let graph: Graph;
    try {
      graph = new Graph(host, {
        /**
         * **No `spaceSize` here, and that is the point.**
         *
         * The coordinate box belongs to whatever wrote the positions, not to the thing drawing
         * them. We used to declare it — one exported `SPACE = 4096`, copied by hand into both bench
         * generators — and a corpus fossil writes ignored it completely: a million vertices span
         * about x ∈ [−345, 645396], 157× the box the renderer was announcing. Nothing announced the
         * disagreement, because `spaceSize` enters every render path as a translation and the camera
         * is fitted from the extent anyway; the box was simply a false statement.
         *
         * So the box arrives with the first `extent()` — `useBoundedGraph` sets it where it already
         * awaits one — and until then cosmos.gl's own default stands. A default of ours would be a
         * second way to answer a question one side already owns.
         */
        enableSimulation: simulate,
        ...forces(applied.current),
        /**
         * Frames to convergence — not milliseconds.
         *
         * `store.alphaDecay` is `α ⇒ 1 − 0.001^(1/α)` with `alphaTarget` 0, and one tick is one
         * rendered frame (`runSimulationStep` is called from `renderFrame`), so alpha decays as
         * `0.001^(n/α)` and reaches the `1e-3` floor after exactly `simulationDecay` frames — 400 ≈
         * 6.7 s at 60 fps, against cosmos.gl's default of 5,000 ≈ 83 s.
         */
        simulationDecay: 400,
        /**
         * Same seed, same picture. cosmos.gl's own randomness is not otherwise deterministic: the
         * per-link distance variation and the ±1e-5 jitter the force programs sow read
         * `store.random`, which is unseeded unless this is set. Init-only; `setConfig` cannot change
         * it.
         */
        randomSeed: "kanzo-discovery",
        /**
         * The device's, not cosmos.gl's literal `2`.
         *
         * It sizes the drawing buffer (`canvas.width = width * pixelRatio`) and divides the hardware
         * point-size limit into `maxPointSize`. Left at the default, a 1× display supersamples 4× for
         * nothing and a 3× display draws a canvas softer than the page it sits in.
         */
        pixelRatio: window.devicePixelRatio || 1,
        enableDrag: true,
        fitViewOnInit: true,
        fitViewDelay: 900,
        fitViewPadding: 0.18,
        hoveredPointCursor: "pointer",
        attribution: "",
        onSimulationStart: () => callbacks.current.report("running"),
        onSimulationEnd: () => {
          callbacks.current.report("settled");
          progress(1);
          frameOnce();
          live.current.onTick?.();
        },
        onSimulationPause: () => callbacks.current.report("paused"),
        onSimulationUnpause: () => callbacks.current.report("running"),
        onSimulationTick: () => {
          const instance = graphRef.current;
          if (instance) progress(instance.progress);
          live.current.onTick?.();
        },
        onZoom: () => live.current.onZoom?.(),
        onPointMouseOver: (index) => {
          hovering = index;
          live.current.onPointerOver?.(index);
        },
        onPointMouseOut: () => {
          hovering = null;
          live.current.onPointerOut?.();
        },
        onDragStart: () => {
          dragging = hovering;
        },
        onDragEnd: () => {
          if (dragging !== null) live.current.onDragEnd?.(dragging);
          dragging = null;
        },
        onPointClick: (index) => {
          const instance = graphRef.current;
          if (instance) live.current.onPointClick?.(instance, index);
        },
        onBackgroundClick: () => live.current.onBackgroundClick?.(),
      });
    } catch (error) {
      callbacks.current.onFailure(`The renderer failed to start. (${String(error)})`);
      return;
    }
    graphRef.current = graph;
    const painted = whenReady(graph, (ready) => ready.render());
    /**
     * **A lost context is silent, permanent, and indistinguishable from a graph with no data.**
     *
     * Losing one is not an exception: the canvas stops painting, `getPointPositions()` reads back
     * empty and `getZoomLevel()` answers zero, while every setter keeps accepting arrays. Measured
     * on `/docs/graph`, where three of four canvases sat at `isContextLost === true` with a badge
     * beside each reporting a full slice — and the renderer had **fifteen free slots at the time**,
     * because the loss happened during the load and nothing brings a context back.
     *
     * `preventDefault()` is what asks the browser to try a restore at all; without it there is no
     * `webglcontextrestored` event to hear. We do not rebuild on it yet — that means re-uploading
     * every buffer from a slice this hook does not hold — so the honest thing is to say so through
     * the one callback this package makes required, and `decisions/` carries what a rebuild would
     * take. An empty box that explains itself is the floor, not the ceiling.
     */
    const onLost = (event: Event) => {
      event.preventDefault();
      callbacks.current.onFailure(
        "The graph's WebGL context was lost. A browser keeps a limited number of them and drops the oldest; reload the page to get one back.",
      );
    };
    // **Attached inside `whenReady`, and the first version of this was attached outside it and did
    // nothing.** cosmos.gl creates its canvas with the device, which is asynchronous — so
    // `host.querySelector("canvas")` in this line's position answers `null`, the listener goes on
    // nothing, and the release below frees nothing. It looked correct and changed no behaviour at
    // all, which is the second time on this hook that a device call has been written as though the
    // instance were ready.
    const listening = whenReady(graph, () => {
      host.querySelector("canvas")?.addEventListener("webglcontextlost", onLost);
    });
    // Without a simulation there is nothing to settle and nothing to wait for, so the badge starts
    // where it ends. With one, construction fires no `onSimulationStart` — the graph is already
    // turning by the time we get here, and without this the transport opens showing Play over a
    // moving graph.
    callbacks.current.report(simulate && graph.isSimulationRunning ? "running" : "settled");
    const floor = setTimeout(frameOnce, FRAME_BY);
    return () => {
      clearTimeout(floor);
      painted();
      listening();
      // Read here rather than remembered from construction, and before `destroy()` rather than
      // after: the element does not exist until the device does, and it goes away with the graph.
      const canvas = host.querySelector("canvas");
      canvas?.removeEventListener("webglcontextlost", onLost);
      graph.destroy();
      releaseContext(canvas);
      graphRef.current = null;
    };
    // **`onFailure` and `report` are deliberately absent**, and the ref above says why: a renderer
    // whose lifetime follows a caller's render identity is a renderer that never lives long enough
    // to be given anything. `simulate` stays, because it is a construction option — and `progress`
    // stays because it is a `useCallback` over an empty list that reads the ref itself, so it is
    // stable by construction rather than by a caller remembering to make it so.
  }, [graphRef, hostRef, progress, simulate]);

  /**
   * Cluster seeding, and only under a live layout — it is a force, not a colour.
   *
   * Both calls or neither is worth having: clusters without positions is a pull toward a centroid
   * that moves with its own group. Neither flushes anything on its own; the next `render()` does,
   * and the query loop renders on every slice.
   */
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !simulate || !clusters) return;
    return whenReady(graph, (ready) => {
      ready.setPointClusters(clusters);
      // The box the ring is placed in is the renderer's live one — `graph.config` is always fully
      // populated, so this reads either cosmos.gl's default or the extent `useBoundedGraph` set.
      // Read after `ready` for the same reason it is written after it: before the device, the
      // config is cosmos.gl's default and the ring would be sized for a box nobody is drawing in.
      ready.setClusterPositions(clusterRing(clusters, ready.config.spaceSize));
      ready.render();
    });
  }, [clusters, graphRef, simulate]);

  // A change in the forces re-heats: the point of a live layout is that you can feel the parameter.
  // Equality on mount is what keeps a re-render from disturbing a settled graph.
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !simulate || applied.current === sim) return;
    applied.current = sim;
    return whenReady(graph, (ready) => {
      ready.setConfigPartial(forces(sim));
      ready.start(REHEAT);
    });
  }, [graphRef, sim, simulate]);
}

/**
 * The energy a wake puts back into a converged layout — enough to reorganise around a changed force,
 * not so much that the picture you were reading is thrown away. A full `start(1)` is what Re-run is
 * for.
 */
export const REHEAT = 0.35;

/** The settle fit: long enough to read as the camera moving, and the same air the init fit leaves. */
const FIT_DURATION = 450;
const FIT_PADDING = 0.18;

/**
 * When the camera frames the view — 6 s after the graph is built.
 *
 * Late enough that a layout has done its spreading and contracting, early enough that nobody has
 * started reading the wrong framing. It is a wall clock, so it is also the answer for a display that
 * is not running at 60 fps, where a settle at `simulationDecay` frames arrives late.
 */
const FRAME_BY = 6000;

/**
 * How finely settling progress is reported: twentieths, so a settle costs 20 renders of everything
 * reading the graph's context rather than one per frame.
 */
const PROGRESS_STEPS = 20;
