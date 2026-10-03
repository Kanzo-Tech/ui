import { Graph } from "@cosmos.gl/graph";
import { GraphError } from "../core/error";
import type { Geometry } from "../core/load";
import type { GraphStore } from "../core/store";
import type { GraphCommands, Motion, VertexId } from "../core/types";
import { resolveLook, type Look } from "./graph-looks";
import { appearance, forces, paint } from "./graph-model";
import { resolveSim, type Sim } from "./graph-sim";
import { createCamera, FIT_DURATION } from "./camera";
import { decayFor, highlighted, LINKS_WHILE_RUNNING, simulating } from "./motion";
import { cornersOf, placed, placementOf } from "./placement";
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

const REHEAT = 0.35;
/** Twentieths: a settle costs twenty reports rather than one per frame. */
const PROGRESS_STEPS = 20;

/**
 * The slowest honest answer for a GPU device: one comes up in milliseconds when it can be made at
 * all, so ten seconds is a device that will not come, not one that is slow.
 */
const READY_DEADLINE = 10_000;

/**
 * **cosmos.gl's lifetime, and the frame that renders once.** Built once per element; it subscribes to
 * the store and discharges what changed in one `requestAnimationFrame`:
 *
 * - a new graph uploads positions and links, once per corpus and per position binding;
 * - a binding, a look or a theme change uploads colours, sizes, shapes and clusters and nothing else;
 * - a filter, a selection, a focus or a pin sets config and uploads nothing, and never calls
 *   `render()`: a vertex the page's filter does not keep is greyed out, Cosmograph's way, so the
 *   points never move because a chart was brushed;
 * - the camera reaches nothing: cosmos.gl moves it, and the overlays follow.
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
    if (placing) {
      dirty.positions = false;
      graph.setPointPositions(position(placing), true);
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
    if (placing) layout(placing, simulating(options, placing)); // after render(): cosmos.gl 3.4 turning its simulation on drops unrendered uploads
    if (geometry && encoding && !dirty.paint) store.reportDrawn(snapshot);
    events.onFrame?.();
  }

  /** The positions cosmos.gl gets: bound, the data's extent centred in the device's box; unbound, the seeded start. */
  function position(geometry: Geometry): Float32Array {
    const placement = geometry.bound && geometry.extent ? placementOf(geometry.extent, box as number) : null;
    graph.setConfigPartial({ spaceSize: placement?.side ?? geometry.space, simulationDecay: decayFor(geometry.size) });
    if (!placement || !geometry.extent) return geometry.positions;
    camera.frame(cornersOf(geometry.extent, placement));
    return placed(geometry.positions, placement);
  }

  /** A new geometry lays itself out when its positions are a start, and stands still when they are data. */
  function layout(geometry: Geometry, running: boolean): void {
    camera.drawn();
    if (running) return run(1);
    if (live) graph.pause();
    if (!geometry.bound) camera.fit();
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
    fail(new GraphError("graph/context-lost", "The browser took back the WebGL context; reload to get one."));
  };
  const noDevice = (data: GraphError["data"], cause?: unknown) =>
    fail(new GraphError("graph/no-webgl", "No GPU device came up to draw with.", data, { cause }));
  // `ready` never settles when cosmos.gl cannot make a device, so the deadline is what ends the wait.
  const deadline = setTimeout(() => noDevice({ after: READY_DEADLINE }), READY_DEADLINE);
  void graph.ready.then(
    () => {
      clearTimeout(deadline);
      if (!destroyed) host.querySelector("canvas")?.addEventListener("webglcontextlost", onLost);
      camera.ready();
    },
    (error: unknown) => {
      clearTimeout(deadline);
      noDevice({}, error);
    },
  );
  store.report(live && graph.isSimulationRunning ? "running" : "settled");
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
      if (frame) cancelAnimationFrame(frame);
      clearTimeout(deadline);
      camera.destroy();
      destroyed = true;
      // Read here rather than remembered from construction: the element exists only with the device.
      const canvas = host.querySelector("canvas");
      canvas?.removeEventListener("webglcontextlost", onLost);
      graph.destroy();
      releaseContext(canvas);
    },
  };
}
