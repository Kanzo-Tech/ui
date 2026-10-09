import { Graph } from "@cosmos.gl/graph";
import { GraphError } from "../core/error";
import type { Geometry } from "../core/load";
import type { Arrangement, GraphStore } from "../core/store";
import type { GraphCommands, Motion, VertexId } from "../core/types";
import { resolveLook, type Look } from "./graph-looks";
import { appearance, forces, paint } from "./graph-model";
import { resolveSim, type Sim } from "./graph-sim";
import { createCamera, FIT_DURATION } from "./camera";
import { decayFor, highlighted, LINKS_WHILE_RUNNING, simulating } from "./motion";
import { cornersOf, placed, placementOf } from "./placement";
import { holdDevice, webglBox } from "./webgl";

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

const REHEAT = 0.35;
/** Locate's margin around a vertex and its neighbours, a share of the viewport — wider than a fit's, so the neighbourhood reads as a group in its context. */
const LOCATE_PADDING = 0.3;
/** How much closer Locate goes to a vertex with no neighbour to frame. */
const LOCATE_ZOOM = 4;
/** Twentieths: a settle costs twenty reports rather than one per frame. */
const PROGRESS_STEPS = 20;

/**
 * **cosmos.gl's lifetime, and the frame that renders once.** Built once per element; it subscribes to
 * the store and discharges what changed in one `requestAnimationFrame`:
 *
 * - a new graph uploads positions and links, once per corpus and per position binding;
 * - a binding, a look or a theme change uploads colours, sizes, shapes and clusters and nothing else;
 * - a filter, a selection or a focus sets config and uploads nothing, and never calls
 *   `render()`: a vertex the page's filter does not keep is greyed out, Cosmograph's way, so the
 *   points never move because a chart was brushed;
 * - the camera reaches nothing: cosmos.gl moves it, and the overlays follow.
 *
 * **The arrangement is the store's, and this is a view of it.** Destroyed, it writes the points and
 * the camera back with `store.keep`; built over a kept arrangement, it uploads that instead of the
 * geometry's start and the layout goes on as it was: settled stays still, paused stays paused, and a
 * running one is resumed with a reheat. A detached canvas holds no GPU at all.
 *
 * A vertex's id is its index here, so nothing is resolved between the store and the buffers.
 * `transitionDuration` is 0: the default animates every upload for 800 ms and keeps the loop awake.
 * The layout runs on its own when `x` and `y` are unbound, and from the current positions.
 * Every callback reads the store's latest options, so a host's inline `onFailure` never rebuilds it.
 * A failure to draw at all marks the store `failed` through `unrenderable`, never `onFailure` alone.
 */
export function createRenderer(host: HTMLDivElement, store: GraphStore, events: RendererEvents = {}): Renderer | null {
  let destroyed = false;
  const fail = (error: unknown) => {
    if (!destroyed) store.unrenderable(error);
  };
  const box = webglBox();
  if (box === null) {
    fail(new GraphError("graph/no-webgl", "This browser offers no WebGL context to draw with."));
    return null;
  }

  let sim: Sim = resolveSim(store.getOptions().sim);
  let live = false;
  /** Whether a layout is moving the points — ours, since cosmos.gl's flag waits for its device. */
  let moving = false;
  let reported = -1;
  const progress = (value: number) => {
    const bucket = Math.round(value * PROGRESS_STEPS);
    if (bucket === reported) return;
    reported = bucket;
    store.reportProgress(bucket / PROGRESS_STEPS);
  };

  let look: Look = resolveLook(store.getOptions().look);
  let lookPatch = store.getOptions().look;
  const dirty = { positions: true, paint: true, state: true };
  let frame = 0;
  let links: Float32Array | null = null;
  /** The geometry whose positions this canvas uploaded and rendered: the only one it can write back. */
  let shown: Geometry | null = null;
  let last = store.getSnapshot();
  let lastOptions = store.getOptions();

  const size = () => store.getSnapshot().geometry?.size ?? 0;

  let graph: Graph;
  try {
    graph = new Graph(host, {
      // No `spaceSize` here: it is the geometry's, set when the graph has loaded.
      // `rescalePositions: false` because the placement below is ours.
      rescalePositions: false,
      fitViewOnInit: false,
      transitionDuration: 0,
      enableSimulation: live,
      ...forces(sim),
      randomSeed: "kanzo-discovery",
      pixelRatio: window.devicePixelRatio || 1,
      enableDrag: true,
      hoveredPointCursor: "pointer",
      attribution: "",
      onSimulationStart: () => store.report("running"),
      onSimulationEnd: () => {
        moved("settled");
        progress(1);
        camera.settle();
        events.onFrame?.();
      },
      onSimulationPause: () => moved("paused"),
      onSimulationUnpause: () => moved("running"),
      onSimulationTick: (_alpha, index, position) => {
        progress(graph.progress);
        camera.tick();
        if (index !== undefined && position) events.onHover?.(position);
        events.onFrame?.();
      },
      onZoomStart: (_event, userDriven) => taken(userDriven),
      onZoom: () => events.onFrame?.(),
      onPointMouseOver: (index, position) => {
        events.onHover?.(position);
        store.hover(index);
      },
      onPointMouseOut: () => {
        events.onHover?.(null);
        store.hover(null);
      },
      onDrag: (event) => {
        events.onHover?.(graph.screenToSpacePosition([event.x, event.y]));
        events.onFrame?.();
      },
      onPointClick: (index) => focusOn(index),
      onBackgroundClick: () => clear(),
    });
  } catch (error) {
    fail(new GraphError("graph/no-webgl", "The renderer failed to start.", {}, { cause: error }));
    return null;
  }
  const { camera, taken } = createCamera(graph, host, fail);

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
    // Positions wait for the first colours, so a graph's first frame is the drawn one, not a grey one.
    const placing = dirty.positions && encoding ? geometry : null;
    const kept = placing && snapshot.arrangement;
    if (placing) {
      dirty.positions = false;
      graph.setPointPositions(position(placing, kept), true);
      if (placing.links !== links) {
        links = placing.links;
        graph.setLinks(links);
        dirty.paint = dirty.state = true;
      }
    }
    const painting = dirty.paint && geometry && encoding;
    if (painting) {
      dirty.paint = false;
      const buffers = paint(geometry, encoding, look, host, options);
      graph.setPointColors(buffers.colors);
      graph.setPointSizes(buffers.sizes);
      graph.setPointShapes(buffers.shapes);
      graph.setLinkColors(buffers.linkColors);
      graph.setPointClusters(encoding.clusters ?? []);
      graph.setConfigPartial({ ...appearance(look, host), renderLinks: linksShown() });
    }
    if (dirty.state && geometry) {
      dirty.state = false;
      graph.setConfigPartial({
        ...highlighted(geometry, snapshot.mask, snapshot.selection?.vertices ?? null),
        focusedPointIndex: snapshot.focus === null || snapshot.focus >= geometry.size ? undefined : snapshot.focus,
      });
    }
    if (painting || placing) graph.render();
    if (placing) {
      shown = placing;
      layout(placing, kept); // after render(): cosmos.gl 3.4 turning its simulation on drops unrendered uploads
    }
    if (geometry && encoding && !dirty.paint) store.reportDrawn(snapshot);
    events.onFrame?.();
  }

  /**
   * The positions cosmos.gl gets: where the last canvas left them, already in the square; else bound,
   * the data's extent centred in the device's box; unbound, the seeded start. The square is the same
   * either way, since the box is the device's.
   */
  function position(geometry: Geometry, kept: Arrangement | null): Float32Array {
    const placement = geometry.bound && geometry.extent ? placementOf(geometry.extent, box as number) : null;
    graph.setConfigPartial({ spaceSize: placement?.side ?? geometry.space, simulationDecay: decayFor(geometry.size) });
    if (kept?.view) camera.restore(kept.view);
    else if (placement && geometry.extent) camera.frame(cornersOf(geometry.extent, placement));
    if (kept) return kept.positions;
    return placement ? placed(geometry.positions, placement) : geometry.positions;
  }

  /**
   * A new geometry lays itself out when its positions are a start, and stands still when they are
   * data. A kept one goes on as it was left: `motion` is still what it was when the last canvas went.
   */
  function layout(geometry: Geometry, kept: Arrangement | null): void {
    camera.drawn();
    const running = kept ? store.getSnapshot().motion === "running" : simulating(store.getOptions(), geometry);
    if (running) return run(kept ? REHEAT : 1);
    if (live) graph.pause();
    if (!geometry.bound && !kept?.view) camera.fit();
  }

  /** What this canvas leaves the next: the points as cosmos.gl holds them, and the camera. */
  function keep(): void {
    if (shown === null || shown !== store.getSnapshot().geometry || !graph.isReady) return;
    store.keep({ positions: new Float32Array(graph.getPointPositions()), view: camera.view(host.clientWidth, host.clientHeight) });
  }

  /** Whether links are drawn now: the look's choice, unless a large layout is running. */
  const linksShown = (): boolean => look.link.render && !(moving && (links?.length ?? 0) / 2 > LINKS_WHILE_RUNNING);
  const showLinks = () => graph.setConfigPartial({ renderLinks: linksShown() });
  function moved(motion: Motion): void {
    moving = motion === "running";
    showLinks();
    store.report(motion);
  }

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
    camera.run();
    moving = true;
    graph.start(alpha);
    showLinks();
  }

  function focusOn(vertex: VertexId): number[] {
    const around = graph.getNeighboringPointIndices(vertex) ?? [];
    store.select([vertex, ...around], "node", "Node");
    store.focus(vertex);
    return around;
  }

  function clear(): void {
    store.select(null);
    store.focus(null);
  }

  // cosmos.gl 3.4 queues every setter and command until its device exists (`ensureDevice`), and its
  // two synchronous hit tests answer `[]` until then; only the canvas element has to wait for `ready`.
  graph.setConfigPartial(appearance(look, host));
  graph.render();
  const release = holdDevice(graph, host, fail, camera.ready);
  if (store.getSnapshot().arrangement === null) store.report("settled");
  schedule();

  const unsubscribe = store.subscribe(() => {
    const snapshot = store.getSnapshot();
    const options = store.getOptions();
    if (snapshot.geometry !== last.geometry) dirty.positions = true;
    if (snapshot.encoding !== last.encoding) dirty.paint = true;
    if (options.look !== lookPatch) {
      lookPatch = options.look;
      look = resolveLook(options.look);
      dirty.paint = true;
    }
    if (options.fill !== lastOptions.fill || options.symbol !== lastOptions.symbol || options.stroke !== lastOptions.stroke) {
      dirty.paint = true;
    }
    if (snapshot.selection !== last.selection || snapshot.focus !== last.focus || snapshot.mask !== last.mask) dirty.state = true;
    if (options.sim !== lastOptions.sim) applyForces(options.sim);
    const wants = simulating(options, snapshot.geometry);
    if (snapshot.geometry === last.geometry && wants !== simulating(lastOptions, last.geometry)) {
      if (wants) run(REHEAT);
      else graph.pause();
    }
    last = snapshot;
    lastOptions = options;
    if (dirty.positions || dirty.paint || dirty.state) schedule();
  });

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
      camera.take();
      graph.setZoomLevel(graph.getZoomLevel() * factor, 220);
    },
    fit: () => camera.fit(),
    pause() {
      graph.pause();
    },
    resume() {
      const settled = store.getSnapshot().motion === "settled";
      if (settled || !live) run(REHEAT);
      else graph.unpause();
    },
    restart() {
      run(1);
    },
    // Frames the vertex with its neighbours, Linkurious's locate: close enough to read, and the
    // edges it has in view. A vertex with none is zoomed into, never out of.
    reveal(vertex) {
      if (vertex >= size()) return;
      camera.take();
      const around = focusOn(vertex);
      if (around.length > 0) graph.fitViewByPointIndices([vertex, ...around], FIT_DURATION, LOCATE_PADDING);
      else graph.zoomToPointByIndex(vertex, FIT_DURATION, graph.getZoomLevel() * LOCATE_ZOOM, false);
    },
    frame() {
      const visible = store.visible();
      if (visible === null) return camera.fit();
      camera.take();
      const vertices = visible.filter((id) => id < size());
      if (vertices.length > 0) graph.fitViewByPointIndices(vertices, FIT_DURATION, 0.25);
    },
    clear,
    destroy() {
      unsubscribe();
      keep();
      if (frame) cancelAnimationFrame(frame);
      camera.destroy();
      destroyed = true;
      release();
    },
  };
}
