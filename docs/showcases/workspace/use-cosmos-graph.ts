"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { Graph } from "@cosmos.gl/graph";
import { clusterRing } from "./cluster-ring";
import { forces, SPACE, type Loaded } from "./graph-model";
import type { Motion, Sim } from "./graph-state";

/**
 * The renderer's whole life: built once from the options cosmos.gl cannot change later, told what
 * the forces are, and destroyed on the way out.
 *
 * Everything else about the picture — colours, sizes, shapes, the look, the camera — is a
 * `setConfig` somewhere else, which is the reason changing a look does not rebuild the graph. Only
 * the options listed in the constructor below are genuinely immutable, and the callbacks are handed
 * over exactly once, which is why every one of them reads the present through a ref rather than a
 * closure.
 */

/**
 * Whether this browser can run the renderer at all.
 *
 * Asked rather than inferred: regl reports a missing context by `console.error` and cosmos.gl draws
 * its own English message into the host element — it never throws. So the `try/catch` around the
 * constructor was catching a case that cannot reach it, and the honest-looking failure branch below
 * it was dead code. The catch stays for real construction faults; this answers the common one, and
 * lets the canvas say so in its own voice.
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


export interface CosmosGraphOptions {
  /** The element cosmos.gl mounts its canvas into. */
  hostRef: RefObject<HTMLDivElement | null>;
  /**
   * Where to put the instance.
   *
   * Given rather than returned, because the overlays and the gesture need a way to reach the graph
   * and this hook needs their callbacks — returning it would make the two declarations circular.
   */
  graphRef: RefObject<Graph | null>;
  data: Loaded | null;
  sim: Sim;
  /** Where to report what the layout is doing. */
  report: (motion: Motion) => void;
  /**
   * How far through settling the layout is, `0`–`1`.
   *
   * cosmos.gl computes it every tick as `√(ALPHA_MIN / alpha)` and exposes it as `graph.progress`,
   * so a determinate badge costs nothing to compute — only to deliver. Quantised before it is
   * reported, because this is React state read through context and a write per animation frame
   * would re-render every consumer 60 times a second to move a number by half a percent.
   */
  reportProgress: (value: number) => void;
  onFailure: (message: string) => void;
  /** Callbacks handed to cosmos.gl once, at construction. */
  events: {
    onPointerOver: (index: number) => void;
    onPointerOut: () => void;
    onPointClick: (graph: Graph, index: number) => void;
    onBackgroundClick: () => void;
    /**
     * A node has been let go of, by index.
     *
     * cosmos.gl does not say which one. Its drag subject is `{x, y}`, and `store.draggingPointIndex`
     * is cleared *before* `onDragEnd` is called — so the index is remembered from the hover that
     * made the drag possible in the first place: the drag behaviour's subject only answers while
     * `store.hoveredPoint` is set, and hover detection is skipped for the whole gesture.
     */
    onDragEnd: (index: number) => void;
    onTick: () => void;
    onZoom: () => void;
  };
}

export function useCosmosGraph(options: CosmosGraphOptions): void {
  const { data, events, graphRef, hostRef, onFailure, report, reportProgress, sim } = options;

  /**
   * The coefficients the graph is currently running with.
   *
   * The constructor takes them and the effect below re-applies them when they move — so this is
   * not a "first render" flag, it is the answer to *what does the simulation already have?*, which
   * is the question both places are asking.
   */
  const applied = useRef(sim);
  const live = useRef(events);
  live.current = events;

  /**
   * Whether the camera has been put where the converged layout is.
   *
   * `fitViewOnInit` frames the graph at `fitViewDelay`, a second in, while the simulation is still
   * contracting — so by the time it converges the picture has shrunk to a blob in the middle of an
   * empty canvas and the first thing anyone has to do is reach for Fit to view. The early fit is
   * still worth having, because a second of *something* beats a second of nothing; it just is not
   * the last word. This one is: once, at the first settle, and never again — re-framing on later
   * settles would yank the camera out from under whoever nudged a slider.
   */
  const framed = useRef(false);

  /** The last bucket handed on, so a tick that has not moved the badge costs nothing. */
  const reported = useRef(-1);
  const progress = useCallback(
    (value: number) => {
      const bucket = Math.round(value * PROGRESS_STEPS);
      if (bucket === reported.current) return;
      reported.current = bucket;
      reportProgress(bucket / PROGRESS_STEPS);
    },
    [reportProgress],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!data || !host) return;
    framed.current = false;
    if (!hasWebGL()) {
      onFailure("This canvas renders on the GPU, and this browser offers no WebGL context.");
      return;
    }
    /**
     * Put the camera where the layout ended up — once, whoever gets here first.
     *
     * The two now genuinely race. `onSimulationEnd` fires when alpha crosses `1e-3`, which
     * `simulationDecay: 400` puts at 400 rendered frames — 6.7 s at 60 fps, 3.3 s at 120, and the
     * crossover with `FRAME_BY`'s 6 s is 66.7 fps. Neither is the plan and neither is a floor under
     * the other, and on any display it is the same picture: the loser is at most 0.7 s behind, and
     * a graph 6 s into a 6.7 s settle has `0.001^(6/6.7)` ≈ 0.002 of its energy left.
     *
     * A tie needs no rule. JavaScript runs one of them to completion first, and whichever that is
     * sets `framed` before the other is entered — so the second call returns having done nothing.
     * The camera is never fitted twice and no `fitView` animation is ever cut off by a second one.
     *
     * The one case where they are not interchangeable is a backgrounded tab: `requestAnimationFrame`
     * stops, so no frame is a tick and the settle cannot arrive, while `setTimeout` still fires. The
     * timer wins on a graph that has barely moved and `framed` makes that final. That was already
     * true when the timer always won; a faster decay does not fix it, and framing on a settle that
     * may never come would be worse.
     */
    const frameOnce = () => {
      if (framed.current) return;
      framed.current = true;
      graphRef.current?.fitView(FIT_DURATION, FIT_PADDING);
    };

    // Which node the pointer is on, and which one the current gesture picked up. Locals rather than
    // refs: they are read and written only by callbacks this closure owns, and they die with the
    // instance those callbacks belong to.
    let hovering: number | null = null;
    let dragging: number | null = null;

    let graph: Graph;
    try {
      graph = new Graph(host, {
        spaceSize: SPACE,
        enableSimulation: true,
        ...forces(applied.current),
        /**
         * Frames to convergence — not milliseconds.
         *
         * `store.alphaDecay` is `α ⇒ 1 − 0.001^(1/α)` with `alphaTarget` 0, and one tick is one
         * rendered frame (`runSimulationStep` is called from `renderFrame`), so alpha decays as
         * `0.001^(n/α)` and reaches the `1e-3` floor after exactly `simulationDecay` frames. This is
         * **400 ≈ 6.7 s at 60 fps**, against cosmos.gl's default of 5,000 ≈ 83 s.
         *
         * The number that matters more than the first settle is the second: a slider re-heats to
         * `REHEAT` rather than to 1, and `0.35` reaches the floor in `α·ln(0.001/0.35)/ln(0.001)`
         * ≈ 339 frames — 5.7 s of reorganising after a nudge, where 1,600 made it 22.6 s and a
         * reader had no way to tell a slow layout from a stuck one.
         *
         * Shorter also means less relaxation, and how settled the picture *looks* at the end of it
         * is not a number this comment can carry. It was chosen, not measured.
         */
        simulationDecay: 400,
        /**
         * Same seed, same picture. Our positions are already deterministic — `mulberry32` seeds
         * them in `lib/force-layout` — but cosmos.gl's own randomness is not: the per-link distance
         * variation and the ±1e-5 jitter the force programs sow read `store.random`, which is
         * unseeded unless this is set. Without it the layout differs run to run from identical
         * input. Init-only; `setConfig` cannot change it.
         */
        randomSeed: "kanzo-discovery",
        /**
         * The device's, not cosmos.gl's literal `2`.
         *
         * It sizes the drawing buffer (`canvas.width = width * pixelRatio`) and divides the
         * hardware point-size limit into `maxPointSize`. Left at the default, a 1× display
         * supersamples 4× for nothing and a 3× display draws a canvas softer than the page it
         * sits in.
         */
        pixelRatio: window.devicePixelRatio || 1,
        enableDrag: true,
        fitViewOnInit: true,
        fitViewDelay: 900,
        fitViewPadding: 0.18,
        hoveredPointCursor: "pointer",
        attribution: "",
        onSimulationStart: () => report("running"),
        onSimulationEnd: () => {
          report("settled");
          progress(1);
          frameOnce();
          live.current.onTick();
        },
        onSimulationPause: () => report("paused"),
        onSimulationUnpause: () => report("running"),
        onSimulationTick: () => {
          const instance = graphRef.current;
          if (instance) progress(instance.progress);
          live.current.onTick();
        },
        onZoom: () => live.current.onZoom(),
        onPointMouseOver: (index) => {
          hovering = index;
          live.current.onPointerOver(index);
        },
        onPointMouseOut: () => {
          hovering = null;
          live.current.onPointerOut();
        },
        onDragStart: () => {
          dragging = hovering;
        },
        onDragEnd: () => {
          if (dragging !== null) live.current.onDragEnd(dragging);
          dragging = null;
        },
        onPointClick: (index) => {
          const instance = graphRef.current;
          if (instance) live.current.onPointClick(instance, index);
        },
        onBackgroundClick: () => live.current.onBackgroundClick(),
      });
    } catch (error) {
      onFailure(`The renderer failed to start. (${String(error)})`);
      return;
    }
    graphRef.current = graph;
    graph.setPointPositions(data.positions);
    graph.setLinks(data.links);
    graph.setPointClusters(data.clusters);
    // Both, or neither is worth having: clusters without positions is a pull toward a centroid that
    // moves with its own group. Before `render()`, because that is what flushes the cluster force's
    // textures — `setClusterPositions` only raises a flag.
    graph.setClusterPositions(clusterRing(data.clusters));
    graph.render();
    // The simulation is already turning by the time we get here, and construction fires no
    // `onSimulationStart` — so without this the transport opens showing Play over a moving graph.
    report(graph.isSimulationRunning ? "running" : "settled");
    const floor = setTimeout(frameOnce, FRAME_BY);
    return () => {
      clearTimeout(floor);
      graph.destroy();
      graphRef.current = null;
    };
  }, [data, graphRef, hostRef, onFailure, progress, report]);

  // A change in the forces re-heats: the point of a live layout is that you can feel the parameter.
  // Equality on mount is what keeps a re-run for `data` from disturbing a settled graph.
  useEffect(() => {
    const graph = graphRef.current;
    if (!data || !graph || applied.current === sim) return;
    applied.current = sim;
    graph.setConfig(forces(sim));
    graph.start(REHEAT);
  }, [data, graphRef, sim]);
}

/**
 * The energy a wake puts back into a converged layout — enough to reorganise around a changed
 * force, not so much that the picture you were reading is thrown away. A full `start(1)` is what
 * Re-run is for.
 *
 * Exported because the canvas' Resume command needs the same number: this was defined twice, with
 * the same doc comment, in two files that had to agree.
 */
export const REHEAT = 0.35;

/** The settle fit: long enough to read as the camera moving, and the same air the init fit leaves. */
const FIT_DURATION = 450;
const FIT_PADDING = 0.18;

/**
 * When the camera frames the view — 6 s after the graph is built.
 *
 * Late enough that the layout has done its spreading and contracting, early enough that nobody has
 * started reading the wrong framing. It is a wall clock, so it is also the answer for a display
 * that is not running at 60 fps, where the settle at `simulationDecay` frames arrives late.
 */
const FRAME_BY = 6000;

/**
 * How finely settling progress is reported: twentieths, so the settle costs 20 renders of
 * everything reading the graph's context rather than one per frame.
 */
const PROGRESS_STEPS = 20;
