"use client";

import { useEffect, useRef, type RefObject } from "react";
import { Graph } from "@cosmos.gl/graph";
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
  onFailure: (message: string) => void;
  /** Callbacks handed to cosmos.gl once, at construction. */
  events: {
    onPointerOver: (index: number) => void;
    onPointerOut: () => void;
    onPointClick: (graph: Graph, index: number) => void;
    onBackgroundClick: () => void;
    onTick: () => void;
    onZoom: () => void;
  };
}

export function useCosmosGraph(options: CosmosGraphOptions): void {
  const { data, events, graphRef, hostRef, onFailure, report, sim } = options;

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
     * `onSimulationEnd` is the right moment and an unreliable one. Measured on this corpus: 582
     * nodes and 1,092 edges, and the badge is still reading "Settling" a minute in, so a refit hung
     * only on that event simply never runs and the reader is left with the one-second framing of a
     * layout that has since contracted. The timer below is a floor, not the plan — `framed` keeps
     * it once-only either way, so whichever arrives first wins and the other is a no-op.
     */
    const frameOnce = () => {
      if (framed.current) return;
      framed.current = true;
      graphRef.current?.fitView(FIT_DURATION, FIT_PADDING);
    };

    let graph: Graph;
    try {
      graph = new Graph(host, {
        spaceSize: SPACE,
        enableSimulation: true,
        ...forces(applied.current),
        // The default decay (5000) cools so slowly that the layout never reports itself settled
        // inside a sitting. This converges in a handful of seconds and still looks alive.
        simulationDecay: 1600,
        enableDrag: true,
        fitViewOnInit: true,
        fitViewDelay: 900,
        fitViewPadding: 0.18,
        hoveredPointCursor: "pointer",
        attribution: "",
        onSimulationStart: () => report("running"),
        onSimulationEnd: () => {
          report("settled");
          frameOnce();
          live.current.onTick();
        },
        onSimulationPause: () => report("paused"),
        onSimulationUnpause: () => report("running"),
        onSimulationTick: () => live.current.onTick(),
        onZoom: () => live.current.onZoom(),
        onPointMouseOver: (index) => live.current.onPointerOver(index),
        onPointMouseOut: () => live.current.onPointerOut(),
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
  }, [data, graphRef, hostRef, onFailure, report]);

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
 */
const REHEAT = 0.35;

/** The settle fit: long enough to read as the camera moving, and the same air the init fit leaves. */
const FIT_DURATION = 450;
const FIT_PADDING = 0.18;

/**
 * When the camera stops waiting for a settle that may not come.
 *
 * Late enough that the layout has done its spreading and contracting, early enough that nobody has
 * started reading the wrong framing — and, being once-only, harmless when the settle beats it.
 */
const FRAME_BY = 6000;
