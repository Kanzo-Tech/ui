import { Graph } from "@cosmos.gl/graph";
import type { Box } from "@fossil-lang/corpus";
import type { Resident, VertexId } from "../core/resident";
import { denseOf } from "../core/resident";
import type { GraphSnapshot, GraphStore } from "../core/store";
import { tileOfDense, type Viewport } from "../core/tile-matrix";
import type { GraphCommands } from "../core/types";
import { createComposer, type Composition } from "./compose";
import { resolveLook, type Look } from "./graph-looks";
import { appearance, forces, paint } from "./graph-model";
import { resolveSim, type Sim } from "./graph-sim";
import { isReady, whenReady } from "./when-ready";
import { hasWebGL, releaseContext } from "./webgl";

export interface RendererEvents {
  /** After every frame and every camera move — where the overlays repaint. */
  onFrame?: () => void;
  /** A new composition was uploaded. */
  onComposed?: (composition: Composition) => void;
}

export interface Renderer extends GraphCommands {
  readonly graph: Graph;
  resident(): Resident;
  composition(): Composition | null;
  /** The theme moved under the canvas: colours are resolved again, nothing else. */
  repaint(): void;
  /** The drawn points inside a screen rectangle or polygon, once the device is ready. */
  hit(shape: { rect: [[number, number], [number, number]] } | { polygon: [number, number][] }): number[];
  destroy(): void;
}

const FIT_DURATION = 420;
const FIT_PADDING = 0.18;
const REHEAT = 0.35;
/** Twentieths: a settle costs twenty reports rather than one per frame. */
const PROGRESS_STEPS = 20;

const corners = (box: Box) => [box.x, box.y, box.x + box.w, box.y + box.h];

/**
 * **cosmos.gl's lifetime, and the frame that renders once.** Built once per element; it subscribes to
 * the store and discharges what changed in one `requestAnimationFrame`:
 *
 * - a change of visible tiles recomposes, and dirties positions, links and the per-point arrays;
 * - a look or a theme change dirties colours, sizes and shapes and nothing else;
 * - a selection, a focus or a pin sets two config fields and uploads nothing;
 * - a snapshot that changed none of those schedules nothing.
 *
 * Every callback reads the store's latest options, so a host's inline `onFailure` never rebuilds it.
 */
export function createRenderer(host: HTMLDivElement, store: GraphStore, events: RendererEvents = {}): Renderer | null {
  const fail = (message: string) => store.getOptions().onFailure(message);
  if (!hasWebGL()) {
    fail("This canvas renders on the GPU, and this browser offers no WebGL context.");
    return null;
  }

  let sim: Sim = resolveSim(store.getOptions().sim);
  let hovering: number | null = null;
  let dragging: number | null = null;
  let reported = -1;
  const progress = (value: number) => {
    const bucket = Math.round(value * PROGRESS_STEPS);
    if (bucket === reported) return;
    reported = bucket;
    store.reportProgress(bucket / PROGRESS_STEPS);
  };

  const compose = createComposer();
  let composition: Composition | null = null;
  let look: Look = resolveLook(store.getOptions().look);
  let lookPatch = store.getOptions().look;
  const dirty = { compose: true, paint: true, state: true };
  let frame = 0;
  let framed: GraphSnapshot["matrix"] = null;
  let pendingReveal: VertexId | null = null;
  let last = store.getSnapshot();
  let lastOptions = store.getOptions();

  const resident = () => composition?.resident ?? EMPTY;

  const viewport = (): { view: Viewport; perPixel: number } | null => {
    const { height, width } = host.getBoundingClientRect();
    if (!isReady(graph) || width === 0 || height === 0) return null;
    const [ax, ay] = graph.screenToSpacePosition([0, 0]);
    const [bx, by] = graph.screenToSpacePosition([width, height]);
    const view = { xMin: Math.min(ax, bx), yMin: Math.min(ay, by), xMax: Math.max(ax, bx), yMax: Math.max(ay, by) };
    return { view, perPixel: (view.xMax - view.xMin) / width };
  };
  const observe = () => {
    const camera = viewport();
    if (camera) store.setViewport(camera.view);
  };

  let graph: Graph;
  try {
    graph = new Graph(host, {
      // No `spaceSize` here: the box is the corpus's extent, set when the matrix arrives.
      // `rescalePositions: false` because the corpus's coordinates are the camera's — a rescale
      // between them means the cull and the viewport describe different places.
      rescalePositions: false,
      enableSimulation: store.getOptions().simulate ?? false,
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
        events.onFrame?.();
      },
      onSimulationPause: () => store.report("paused"),
      onSimulationUnpause: () => store.report("running"),
      onSimulationTick: () => {
        progress(graph.progress);
        events.onFrame?.();
      },
      onZoom: () => {
        observe();
        events.onFrame?.();
      },
      onPointMouseOver: (index) => {
        hovering = index;
        store.hover(resident().at(index) ?? null);
      },
      onPointMouseOut: () => {
        hovering = null;
        store.hover(null);
      },
      onDragStart: () => {
        dragging = hovering;
      },
      onDragEnd: () => {
        const vertex = dragging === null ? undefined : resident().at(dragging);
        dragging = null;
        if (vertex !== undefined) store.pin([...store.getSnapshot().pinned, vertex]);
      },
      onPointClick: (index) => {
        const vertex = resident().at(index);
        if (vertex !== undefined) focusOn(vertex, index);
      },
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
      whenReady(graph, draw);
    });
  };

  function draw(ready: Graph): void {
    const snapshot = store.getSnapshot();
    const options = store.getOptions();
    let changed = false;
    if (dirty.compose && snapshot.matrix) {
      dirty.compose = false;
      const next = compose({
        matrix: snapshot.matrix,
        typeIndex: snapshot.typeIndex,
        binding: snapshot.binding,
        modeColumn: snapshot.modeColumn,
        domain: snapshot.domain,
        visible: snapshot.visible,
        cached: snapshot.cached,
        perPixel: viewport()?.perPixel ?? 0,
      });
      if (next) {
        composition = next;
        ready.setPointPositions(next.positions, true);
        ready.setLinks(next.links);
        dirty.paint = true;
        dirty.state = true;
        changed = true;
        events.onComposed?.(next);
        if (pendingReveal !== null && next.resident.indexOf(pendingReveal) !== undefined) {
          const vertex = pendingReveal;
          pendingReveal = null;
          queueMicrotask(() => reveal(vertex));
        }
      }
      const drawn = next && { marks: next.marks, represented: next.represented, domain: next.domain, tally: next.tally };
      store.reportDrawn(snapshot.visible, drawn);
    }
    if (dirty.paint && composition) {
      dirty.paint = false;
      const buffers = paint(composition, look, host, options);
      ready.setPointColors(buffers.colors);
      ready.setPointSizes(buffers.sizes);
      ready.setPointShapes(buffers.shapes);
      ready.setLinkColors(buffers.linkColors);
      ready.setLinkWidths(buffers.linkWidths);
      ready.setConfigPartial(appearance(look, host));
      changed = true;
    }
    if (dirty.state && composition) {
      dirty.state = false;
      const drawn = composition.resident;
      ready.setConfigPartial({
        highlightedPointIndices: snapshot.selection ? drawn.indicesOf(snapshot.selection.vertices) : undefined,
        focusedPointIndex: snapshot.focus === null ? undefined : drawn.indexOf(snapshot.focus),
      });
      const pinned = drawn.indicesOf(snapshot.pinned);
      ready.setPinnedPoints(pinned.length > 0 ? pinned : null);
      changed = true;
    }
    if (changed) ready.render();
    events.onFrame?.();
  }

  const frameExtent = (snapshot: GraphSnapshot) => {
    const extent = snapshot.matrix?.extent;
    if (!extent || snapshot.matrix === framed) return;
    framed = snapshot.matrix;
    whenReady(graph, (ready) => {
      ready.setConfigPartial({ spaceSize: Math.max(extent.w, extent.h) });
      ready.fitViewByPointPositions(corners(extent), 0, FIT_PADDING);
      observe();
    });
  };

  const unsubscribe = store.subscribe(() => {
    const snapshot = store.getSnapshot();
    const options = store.getOptions();
    frameExtent(snapshot);
    if (snapshot.visible !== last.visible || snapshot.binding !== last.binding || snapshot.domain !== last.domain) {
      dirty.compose = true;
    }
    if (options.look !== lookPatch) {
      lookPatch = options.look;
      look = resolveLook(options.look);
      dirty.paint = true;
    }
    if (options.fill !== lastOptions.fill || options.symbol !== lastOptions.symbol || options.stroke !== lastOptions.stroke) {
      dirty.paint = true;
    }
    if (snapshot.selection !== last.selection || snapshot.focus !== last.focus || snapshot.pinned !== last.pinned) {
      dirty.state = true;
    }
    if (options.sim !== lastOptions.sim || options.simulate !== lastOptions.simulate) applyForces(options.sim, options.simulate);
    last = snapshot;
    lastOptions = options;
    if (dirty.compose || dirty.paint || dirty.state) schedule();
  });

  function applyForces(patch: Partial<Sim> | undefined, simulate = false): void {
    const next = resolveSim(patch);
    const moved = Object.keys(next).some((key) => next[key as keyof Sim] !== sim[key as keyof Sim]);
    sim = next;
    whenReady(graph, (ready) => {
      ready.setConfigPartial({ enableSimulation: simulate, ...forces(next) });
      if (simulate && moved) ready.start(REHEAT);
    });
  }

  function focusOn(vertex: VertexId, index: number): void {
    const drawn = resident();
    const around = isReady(graph) ? drawn.verticesAt(graph.getNeighboringPointIndices(index)) : [];
    store.select([vertex, ...around], "node", "Node");
    store.focus(vertex);
  }

  function clear(): void {
    store.select(null);
    store.focus(null);
  }

  /** Centre and select one vertex; one that is not drawn is framed by its tile first, then revealed. */
  function reveal(vertex: VertexId): void {
    const index = resident().indexOf(vertex);
    if (index !== undefined) {
      focusOn(vertex, index);
      whenReady(graph, (ready) => ready.zoomToPointByIndex(index, 500, 5, true));
      return;
    }
    const matrix = store.getSnapshot().matrix;
    const address = matrix ? tileOfDense(matrix, denseOf(vertex)) : null;
    const box = address && matrix?.tileMatrices[address.z]?.tiles[address.tile]?.bbox;
    if (!box) return;
    pendingReveal = vertex;
    whenReady(graph, (ready) => ready.fitViewByPointPositions(corners(box), FIT_DURATION, FIT_PADDING));
  }

  // Primed first, so every `whenReady` below runs with `isReady` already answering true.
  isReady(graph);
  const painted = whenReady(graph, (ready) => {
    ready.setConfigPartial(appearance(look, host));
    ready.render();
  });
  const onLost = (event: Event) => {
    event.preventDefault();
    fail("The graph's WebGL context was lost. A browser keeps a limited number of them and drops the oldest; reload the page to get one back.");
  };
  // Inside `whenReady`: cosmos.gl makes its canvas with the device, which is asynchronous.
  const listening = whenReady(graph, () => {
    host.querySelector("canvas")?.addEventListener("webglcontextlost", onLost);
  });
  store.report(store.getOptions().simulate && graph.isSimulationRunning ? "running" : "settled");
  frameExtent(last);
  schedule();

  return {
    graph,
    resident,
    composition: () => composition,
    repaint() {
      dirty.paint = true;
      schedule();
    },
    hit(shape) {
      if (!isReady(graph)) return [];
      const found = "rect" in shape ? graph.findPointsInRect(shape.rect) : graph.findPointsInPolygon(shape.polygon);
      return Array.from(found);
    },
    zoomBy(factor) {
      whenReady(graph, (ready) => ready.setZoomLevel(ready.getZoomLevel() * factor, 220));
    },
    fit() {
      const extent = store.getSnapshot().matrix?.extent;
      whenReady(graph, (ready) =>
        extent ? ready.fitViewByPointPositions(corners(extent), FIT_DURATION, FIT_PADDING) : ready.fitView(FIT_DURATION, FIT_PADDING),
      );
    },
    pause: () => whenReady(graph, (ready) => ready.pause()),
    resume() {
      const settled = store.getSnapshot().motion === "settled";
      whenReady(graph, (ready) => (settled ? ready.start(REHEAT) : ready.unpause()));
    },
    restart() {
      store.pin([]);
      whenReady(graph, (ready) => ready.start(1));
    },
    unpin() {
      if (store.getSnapshot().pinned.length === 0) return;
      store.pin([]);
      whenReady(graph, (ready) => ready.start(REHEAT));
    },
    reveal,
    frameBox(box, { duration = FIT_DURATION, padding = FIT_PADDING } = {}) {
      whenReady(graph, (ready) => ready.fitViewByPointPositions(corners(box), duration, padding));
    },
    frameSelection() {
      const indices = resident().indicesOf(store.getSnapshot().selection?.vertices ?? []);
      if (indices.length > 0) whenReady(graph, (ready) => ready.fitViewByPointIndices(indices, FIT_DURATION, 0.25));
    },
    clear,
    destroy() {
      unsubscribe();
      if (frame) cancelAnimationFrame(frame);
      painted();
      listening();
      // Read here rather than remembered from construction: the element exists only with the device.
      const canvas = host.querySelector("canvas");
      canvas?.removeEventListener("webglcontextlost", onLost);
      graph.destroy();
      releaseContext(canvas);
    },
  };
}

const EMPTY: Resident = {
  size: 0,
  indexOf: () => undefined,
  at: () => undefined,
  indicesOf: () => [],
  verticesAt: () => [],
};
