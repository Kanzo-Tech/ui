import { Graph } from "@cosmos.gl/graph";
import type { Geometry } from "../core/load";
import type { GraphStore } from "../core/store";
import type { GraphCommands, VertexId } from "../core/types";
import { resolveLook, type Look } from "./graph-looks";
import { appearance, forces, paint } from "./graph-model";
import { resolveSim, type Sim } from "./graph-sim";
import { cornersOf, placed, placementOf, UNPLACED, type Placement } from "./placement";
import { releaseContext, webglBox } from "./webgl";

export interface RendererEvents {
  /** After every frame and every camera move — where the overlays repaint. */
  onFrame?: () => void;
  /** Where the hovered point is in space, as cosmos.gl reports it: no GPU readback per hover. */
  onHover?: (position: [number, number] | null) => void;
}

export interface Renderer extends GraphCommands {
  readonly graph: Graph;
  /** The theme moved under the canvas: colours are resolved again, nothing else. */
  repaint(): void;
  /** The drawn points inside a screen rectangle or polygon, once the device is ready. */
  hit(shape: { rect: [[number, number], [number, number]] } | { polygon: [number, number][] }): number[];
  destroy(): void;
}

const FIT_DURATION = 420;
const FIT_PADDING = 0.18;
const REHEAT = 0.35;
/** How long a release wakes a paused layout before pausing it again. */
const RELEASE_BURST = 1200;
/** Twentieths: a settle costs twenty reports rather than one per frame. */
const PROGRESS_STEPS = 20;
/** How often a running layout re-frames the camera, and how long each re-frame glides. */
const FOLLOW_EVERY = 900;
const FOLLOW_DURATION = 700;

/**
 * **cosmos.gl's lifetime, and the frame that renders once.** Built once per element; it subscribes to
 * the store and discharges what changed in one `requestAnimationFrame`:
 *
 * - a new graph uploads positions and links, once per corpus; a filter uploads positions alone;
 * - a binding, a look or a theme change uploads colours, sizes and shapes and nothing else;
 * - a selection, a focus or a pin sets config and uploads nothing, and never calls `render()`:
 *   `render()` walks every point and link in JS, and `setConfigPartial` asks for its own frame;
 * - the camera reaches nothing: cosmos.gl moves it, and the overlays follow.
 *
 * A vertex's id is its index here, so nothing is resolved between the store and the buffers.
 * `transitionDuration` is 0: the default animates every upload for 800 ms and keeps the loop awake.
 * The live layout is off unless `simulate` or the toolbar asks, and runs from the current positions.
 * Every callback reads the store's latest options, so a host's inline `onFailure` never rebuilds it.
 */
export function createRenderer(host: HTMLDivElement, store: GraphStore, events: RendererEvents = {}): Renderer | null {
  const fail = (message: string) => store.getOptions().onFailure(message);
  const box = webglBox();
  if (box === null) {
    fail("This canvas renders on the GPU, and this browser offers no WebGL context.");
    return null;
  }

  let sim: Sim = resolveSim(store.getOptions().sim);
  let live = store.getOptions().simulate ?? false;
  let hovering: number | null = null;
  let dragging: number | null = null;
  let burst = 0;
  let reported = -1;
  const progress = (value: number) => {
    const bucket = Math.round(value * PROGRESS_STEPS);
    if (bucket === reported) return;
    reported = bucket;
    store.reportProgress(bucket / PROGRESS_STEPS);
  };

  let look: Look = resolveLook(store.getOptions().look);
  let lookPatch = store.getOptions().look;
  const dirty = { positions: true, paint: true, state: true, pinned: true };
  let frame = 0;
  let destroyed = false;
  let framed: Geometry | null = null;
  let placement: Placement | null = null;
  let following = false;
  let followed = 0;
  let links: Float32Array | null = null;
  let last = store.getSnapshot();
  let lastOptions = store.getOptions();

  const size = () => store.getSnapshot().geometry?.size ?? 0;

  let graph: Graph;
  try {
    graph = new Graph(host, {
      // No `spaceSize` here: the box is the corpus's extent, set when the graph has loaded.
      // `rescalePositions: false` because the placement below is ours, and the corpus's own scale.
      rescalePositions: false,
      transitionDuration: 0,
      enableSimulation: live,
      ...forces(sim),
      // Frames to convergence: alpha reaches its floor after exactly this many rendered frames.
      simulationDecay: 400,
      randomSeed: "kanzo-discovery",
      pixelRatio: window.devicePixelRatio || 1,
      enableDrag: true,
      hoveredPointCursor: "pointer",
      attribution: "",
      onSimulationStart: () => store.report("running"),
      onSimulationEnd: () => {
        store.report("settled");
        progress(1);
        if (following) graph.fitView(FIT_DURATION, FIT_PADDING);
        following = false;
        events.onFrame?.();
      },
      onSimulationPause: () => store.report("paused"),
      onSimulationUnpause: () => store.report("running"),
      onSimulationTick: (_alpha, index, position) => {
        progress(graph.progress);
        follow();
        if (index !== undefined && position) events.onHover?.(position);
        events.onFrame?.();
      },
      // The reader took the camera: a running layout stops re-framing it until it runs again.
      onZoomStart: (_event, userDriven) => {
        if (userDriven) following = false;
      },
      onZoom: () => events.onFrame?.(),
      onPointMouseOver: (index, position) => {
        hovering = index;
        events.onHover?.(position);
        store.hover(index);
      },
      onPointMouseOut: () => {
        hovering = null;
        events.onHover?.(null);
        store.hover(null);
      },
      onDragStart: () => {
        dragging = hovering;
      },
      onDrag: (event) => {
        events.onHover?.(graph.screenToSpacePosition([event.x, event.y]));
        events.onFrame?.();
      },
      // d3-force's drag-to-fix, and only while a layout can move the point back: cosmos.gl moves a
      // dragged point with the simulation off too, and a pin nothing pulls against means nothing.
      onDragEnd: () => {
        const vertex = dragging;
        dragging = null;
        const { motion, pinned } = store.getSnapshot();
        if (vertex !== null && motion !== "settled" && !pinned.includes(vertex)) store.pin([...pinned, vertex]);
      },
      onPointClick: (index) => focusOn(index),
      onBackgroundClick: () => clear(),
    });
  } catch (error) {
    fail(`The renderer failed to start. (${String(error)})`);
    return null;
  }

  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      draw();
    });
  };

  function draw(): void {
    const snapshot = store.getSnapshot();
    const { geometry, encoding } = snapshot;
    const options = store.getOptions();
    let changed = false;
    if (dirty.positions && geometry) {
      dirty.positions = false;
      graph.setPointPositions(placed(geometry, frameExtent(geometry), snapshot.mask), true);
      if (geometry.links !== links) {
        links = geometry.links;
        graph.setLinks(links);
        dirty.paint = dirty.state = dirty.pinned = true;
      }
      changed = true;
    }
    if (dirty.paint && geometry && encoding) {
      dirty.paint = false;
      const buffers = paint(geometry, encoding, look, host, options);
      graph.setPointColors(buffers.colors);
      graph.setPointSizes(buffers.sizes);
      graph.setPointShapes(buffers.shapes);
      graph.setLinkColors(buffers.linkColors);
      graph.setConfigPartial(appearance(look, host));
      changed = true;
    }
    if (dirty.state && geometry) {
      dirty.state = false;
      graph.setConfigPartial({
        highlightedPointIndices: snapshot.selection ? snapshot.selection.vertices.filter((id) => id < geometry.size) : undefined,
        focusedPointIndex: snapshot.focus === null || snapshot.focus >= geometry.size ? undefined : snapshot.focus,
      });
    }
    if (dirty.pinned && geometry) {
      dirty.pinned = false;
      graph.setPinnedPoints(snapshot.pinned.length > 0 ? [...snapshot.pinned] : null);
    }
    if (changed) graph.render();
    if (geometry && encoding && !dirty.paint) store.reportDrawn(snapshot);
    events.onFrame?.();
  }

  function frameExtent(geometry: Geometry): Placement {
    if (geometry === framed) return placement ?? UNPLACED;
    if (!geometry.extent) return UNPLACED;
    framed = geometry;
    placement = placementOf(geometry.extent, box as number);
    graph.setConfigPartial({ spaceSize: placement.side });
    graph.fitViewByPointPositions(cornersOf(geometry.extent, placement), 0, FIT_PADDING);
    return placement;
  }

  /** Cosmograph's fit-on-settle, kept up while the layout runs, so a contracting graph stays in view. */
  function follow(): void {
    const now = performance.now();
    if (!following || now - followed < FOLLOW_EVERY) return;
    followed = now;
    graph.fitView(FOLLOW_DURATION, FIT_PADDING);
  }

  const unsubscribe = store.subscribe(() => {
    const snapshot = store.getSnapshot();
    const options = store.getOptions();
    if (snapshot.geometry !== last.geometry || snapshot.mask !== last.mask) dirty.positions = true;
    if (snapshot.encoding !== last.encoding) dirty.paint = true;
    if (options.look !== lookPatch) {
      lookPatch = options.look;
      look = resolveLook(options.look);
      dirty.paint = true;
    }
    if (options.fill !== lastOptions.fill || options.symbol !== lastOptions.symbol || options.stroke !== lastOptions.stroke) {
      dirty.paint = true;
    }
    if (snapshot.selection !== last.selection || snapshot.focus !== last.focus) dirty.state = true;
    if (snapshot.pinned !== last.pinned) dirty.pinned = true;
    if (options.sim !== lastOptions.sim) applyForces(options.sim);
    if ((options.simulate ?? false) !== (lastOptions.simulate ?? false)) {
      endBurst();
      if (options.simulate) run(REHEAT);
      else graph.pause();
    }
    last = snapshot;
    lastOptions = options;
    if (dirty.positions || dirty.paint || dirty.state || dirty.pinned) schedule();
  });

  function applyForces(patch: Partial<Sim> | undefined): void {
    const next = resolveSim(patch);
    const moved = Object.keys(next).some((key) => next[key as keyof Sim] !== sim[key as keyof Sim]);
    sim = next;
    if (!live) return;
    graph.setConfigPartial(forces(next));
    if (moved && store.getSnapshot().motion !== "paused") graph.start(REHEAT);
  }

  /** A layout runs from where the points are: enabling cosmos.gl's simulation keeps its positions. */
  function run(alpha: number): void {
    if (!live) {
      live = true;
      graph.setConfigPartial({ enableSimulation: true, ...forces(sim) });
    }
    following = true;
    followed = performance.now();
    graph.start(alpha);
  }

  function endBurst(): void {
    clearTimeout(burst);
    burst = 0;
  }

  function focusOn(vertex: VertexId): void {
    const around = graph.getNeighboringPointIndices(vertex) ?? [];
    store.select([vertex, ...around], "node", "Node");
    store.focus(vertex);
  }

  function clear(): void {
    store.select(null);
    store.focus(null);
  }

  // cosmos.gl 3.4 queues every setter and command until its device exists (`ensureDevice`), and its
  // two synchronous hit tests answer `[]` until then; only the canvas element has to wait for `ready`.
  graph.setConfigPartial(appearance(look, host));
  graph.render();
  const onLost = (event: Event) => {
    event.preventDefault();
    fail("The graph's WebGL context was lost. A browser keeps a limited number of them and drops the oldest; reload the page to get one back.");
  };
  void graph.ready.then(() => {
    if (!destroyed) host.querySelector("canvas")?.addEventListener("webglcontextlost", onLost);
  });
  store.report(live && graph.isSimulationRunning ? "running" : "settled");
  schedule();

  return {
    graph,
    repaint() {
      dirty.paint = true;
      schedule();
    },
    hit(shape) {
      const found = "rect" in shape ? graph.findPointsInRect(shape.rect) : graph.findPointsInPolygon(shape.polygon);
      return Array.from(found);
    },
    zoomBy(factor) {
      graph.setZoomLevel(graph.getZoomLevel() * factor, 220);
    },
    // Once a layout has moved the points the extent is history, so the fit reads where they are.
    fit() {
      const extent = store.getSnapshot().geometry?.extent;
      if (extent && placement && !live) graph.fitViewByPointPositions(cornersOf(extent, placement), FIT_DURATION, FIT_PADDING);
      else graph.fitView(FIT_DURATION, FIT_PADDING);
    },
    pause() {
      endBurst();
      graph.pause();
    },
    resume() {
      endBurst();
      const settled = store.getSnapshot().motion === "settled";
      if (settled || !live) run(REHEAT);
      else graph.unpause();
    },
    restart() {
      endBurst();
      store.pin([]);
      run(1);
    },
    /**
     * d3's release: unfix, then reheat, so the released points visibly flow back. A running layout
     * takes the heat and goes on; a settled one cools to settled on its own; a paused one gets a
     * bounded burst and is paused again, because the reader paused it.
     */
    unpin() {
      const { motion, pinned } = store.getSnapshot();
      if (pinned.length === 0) return;
      endBurst();
      store.pin([]);
      run(REHEAT);
      if (motion === "paused") {
        burst = window.setTimeout(() => {
          burst = 0;
          graph.pause();
        }, RELEASE_BURST);
      }
    },
    reveal(vertex) {
      if (vertex >= size()) return;
      focusOn(vertex);
      graph.zoomToPointByIndex(vertex, 500, 5, true);
    },
    frameSelection() {
      const vertices = (store.getSnapshot().selection?.vertices ?? []).filter((id) => id < size());
      if (vertices.length > 0) graph.fitViewByPointIndices(vertices, FIT_DURATION, 0.25);
    },
    clear,
    destroy() {
      unsubscribe();
      endBurst();
      if (frame) cancelAnimationFrame(frame);
      destroyed = true;
      // Read here rather than remembered from construction: the element exists only with the device.
      const canvas = host.querySelector("canvas");
      canvas?.removeEventListener("webglcontextlost", onLost);
      graph.destroy();
      releaseContext(canvas);
    },
  };
}
