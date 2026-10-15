import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Selection, clauseInterval } from "@kanzo-tech/mosaic";
import { attach, settle } from "../../test/corpus";
import { isProblem } from "@kanzo-tech/kernel";
import type { GraphOptions } from "../core/state";
import { createGraph } from "../core/store";
import { internalsOf, useGraph } from "../react/use-graph";
import { greyoutOpacity, type Rgb } from "./greyout";

/**
 * The renderer's frame, against a cosmos.gl that records what it is told. What this cannot prove is
 * that cosmos.gl draws what it was given — the browser does, and `/docs/graph/benchmarks` measures it.
 */

const calls: string[] = [];
const constructed: Record<string, unknown>[] = [];
const uploaded: { positions: Float32Array | null; colors: Float32Array | null; config: Record<string, unknown>; view: unknown } = {
  positions: null,
  colors: null,
  config: {},
  view: null,
};
/** What the next graph's `ready` is, and whether its first `render()` throws. */
const device: { ready: () => Promise<void>; broken: unknown } = { ready: () => Promise.resolve(), broken: undefined };
/**
 * cosmos.gl 3.4's position buffer, as it behaves: `setPointPositions` flags an upload that `render()`
 * makes, and turning `enableSimulation` on runs its `create()`, which clears the flag first. A fit that
 * reads positions back with no buffer throws what luma.gl throws.
 */
const gpu = { pending: false, buffer: false, unreadable: false };
/** The duration of every glide the camera was told. */
const durations: number[] = [];
/** What cosmos.gl's link index answers for any point: its neighbours, in buffer indices. */
const neighbours: number[] = [];

vi.mock("@cosmos.gl/graph", () => ({
  Graph: class {
    config: Record<string, (() => void) | undefined>;
    constructor(host: HTMLElement, config: Record<string, unknown>) {
      constructed.push(config);
      this.config = config as never;
      host.append(document.createElement("canvas"));
      this.ready = device.ready();
    }
    ready: Promise<void>;
    isReady = true;
    progress = 1;
    isSimulationRunning = false;
    graph = {};
    screenToSpacePosition([x, y]: [number, number]): [number, number] {
      return [x / 100, y / 100];
    }
    getZoomLevel = () => 1;
    /** A layout that moved every point by one, so a kept position is told from an uploaded one. */
    getPointPositions = () => Array.from(uploaded.positions ?? [], (v) => v + 1);
    setZoomTransformByPointPositions = (positions: Float32Array, _duration: number, zoom: number) => {
      uploaded.view = { center: [...positions], zoom };
      calls.push("view");
    };
    getNeighboringPointIndices = () => [...neighbours];
    fitViewByPointIndices = (indices: number[], duration: number) => {
      durations.push(duration);
      calls.push(`frame:${indices.join(",")}`);
    };
    spaceToScreenPosition = ([x, y]: [number, number]): [number, number] => [x * 100, y * 100];
    zoomToPointByIndex = (index: number, _duration: number, scale: number, canZoomOut: boolean) =>
      calls.push(`zoom:${index}@${scale}${canZoomOut ? "" : " in"}`);
    destroy = () => calls.push("destroy");
    render = () => {
      if (device.broken !== undefined) throw device.broken;
      if (gpu.pending) gpu.buffer = true;
      gpu.pending = false;
      calls.push("render");
    };
    setPointPositions = (positions: Float32Array) => {
      uploaded.positions = positions;
      gpu.pending = true;
      calls.push("positions");
    };
    fitView = () => {
      if (!gpu.buffer || gpu.unreadable) throw new TypeError("Cannot destructure property 'device' of 'texture' as it is undefined.");
      calls.push("fitView");
    };
    setLinks = () => calls.push("links");
    setPointColors = (colors: Float32Array) => {
      calls.push("colors");
      uploaded.colors = colors;
    };
    setPointSizes = () => calls.push("sizes");
    setPointShapes = () => calls.push("shapes");
    setLinkColors = () => calls.push("linkColors");
    setLinkWidths = () => calls.push("linkWidths");
    setPointClusters = () => calls.push("clusters");
    setPinnedPoints = () => calls.push("pinned");
    setConfigPartial = (config: Record<string, unknown>) => {
      if (config.enableSimulation === true && uploaded.config.enableSimulation !== true) gpu.pending = false;
      Object.assign(uploaded.config, config);
      calls.push(`config:${Object.keys(config).join(",")}`);
    };
    fitViewByPointPositions = () => calls.push("fit");
    start = () => {
      calls.push("start");
      this.config.onSimulationStart?.();
    };
    pause = () => {
      this.config.onSimulationPause?.();
      calls.push("pause");
    };
    unpause = () => calls.push("unpause");
  },
}));

const { createRenderer } = await import("./renderer");

const frame = () => new Promise((resolve) => setTimeout(resolve, 20));
const count = (name: string) => calls.filter((call) => call === name).length;
/** What was called, config aside: a setter, a command, a render. */
const commands = () => calls.filter((call) => !call.startsWith("config:"));

beforeEach(() => {
  calls.length = 0;
  durations.length = 0;
  constructed.length = 0;
  uploaded.positions = null;
  uploaded.config = {};
  uploaded.colors = null;
  uploaded.view = null;
  device.ready = () => Promise.resolve();
  device.broken = undefined;
  Object.assign(gpu, { pending: false, buffer: false, unreadable: false });
  vi.stubGlobal("requestAnimationFrame", (run: () => void) => setTimeout(run, 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  // A context already lost, so a destroyed canvas has nothing to give back.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ isContextLost: () => true, clearColor: () => undefined, getParameter: () => null } as unknown as RenderingContext);
});
afterEach(() => vi.restoreAllMocks());

/** The fixture's corpus drawn at its `lon`/`lat` — bound, so nothing runs unless a test asks. */
async function drawing(over: Partial<GraphOptions> = { x: "lon", y: "lat" }) {
  const corpus = await attach();
  const crossfilter = Selection.crossfilter();
  const store = createGraph({ from: corpus.from, engine: corpus.engine, fill: "team", filterBy: crossfilter, onFailure: () => {}, ...over });
  const host = document.createElement("div");
  const renderer = createRenderer(host, store);
  await settle(corpus);
  await frame();
  return { corpus, crossfilter, host, renderer, store };
}

describe("the renderer's frame", () => {
  it("uploads positions and links once per corpus, and renders once", async () => {
    await drawing();
    expect(count("positions")).toBe(1);
    expect(count("links")).toBe(1);
    expect(count("colors")).toBe(1);
    // One from the frame; the other is the first paint of the background before anything loaded.
    expect(count("render")).toBe(2);
  });

  it("repaints colours, sizes and shapes on a look change, and uploads no geometry", async () => {
    const { store } = await drawing();
    calls.length = 0;
    store.setOptions({ ...store.getOptions(), look: { vignette: true } });
    await frame();
    expect(count("colors")).toBe(1);
    expect(count("sizes")).toBe(1);
    expect(count("shapes")).toBe(1);
    expect(count("positions")).toBe(0);
    expect(count("links")).toBe(0);
    expect(count("render")).toBe(1);
  });

  it("greys out at the opacity derived from the colours it painted and its background, links at cosmos.gl's default", async () => {
    await drawing();
    // The colours the paint uploaded, once each, and the background the canvas is cleared to.
    const colors = uploaded.colors!;
    const palette = new Map<string, Rgb>();
    for (let i = 0; i < colors.length; i += 4) palette.set(`${colors[i]},${colors[i + 1]},${colors[i + 2]}`, [colors[i]!, colors[i + 1]!, colors[i + 2]!]);
    const [r, g, b] = uploaded.config.backgroundColor as [number, number, number, number];
    expect(uploaded.config.pointGreyoutOpacity).toBe(greyoutOpacity([...palette.values()], [r, g, b]));
    expect(uploaded.config.linkGreyoutOpacity).toBe(0.1);
  });

  it("greys out a filter with config alone: no upload, no render, links said out loud", async () => {
    const { corpus, crossfilter } = await drawing();
    calls.length = 0;
    crossfilter.update(clauseInterval("score", [2, 5], { source: { reset() {} } }));
    await settle(corpus);
    await frame();
    expect(commands()).toEqual([]);
    // Person 1–4; Place and Tag have no `score`, so the clause keeps none of them.
    expect(uploaded.config.highlightedPointIndices).toEqual([1, 2, 3, 4]);
    // knows 1→2, 2→3, 3→4; every livesIn ends at a Place, which the clause greyed.
    expect(uploaded.config.highlightedLinkIndices).toHaveLength(3);
  });

  it("a camera move notifies nobody", async () => {
    const { store } = await drawing();
    const heard = vi.fn();
    store.subscribe(heard);
    calls.length = 0;
    (constructed[0]?.onZoom as () => void)();
    await frame();
    expect(heard).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it("frames bound positions' extent before it draws anything, and only once", async () => {
    const { store } = await drawing();
    const framed = calls.indexOf("config:spaceSize,simulationDecay");
    expect(framed).toBeGreaterThanOrEqual(0);
    expect(framed).toBeLessThan(calls.indexOf("positions"));
    expect(calls.indexOf("fit")).toBeLessThan(calls.indexOf("positions"));
    store.setOptions({ ...store.getOptions(), r: "score" });
    await frame();
    expect(calls.filter((call) => call.startsWith("config:spaceSize"))).toHaveLength(1);
  });

  it("constructs cosmos.gl with no simulation and no transition", async () => {
    await drawing();
    expect(constructed).toHaveLength(1);
    expect(constructed[0]).toMatchObject({ enableSimulation: false, transitionDuration: 0, fitViewOnInit: false });
  });

  it("a selection sets config and calls no render and no setter", async () => {
    const { store } = await drawing();
    calls.length = 0;
    store.select([3]);
    store.focus(3);
    await frame();
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.filter((call) => !call.startsWith("config:"))).toEqual([]);
  });
});

describe("where the points start", () => {
  it("runs the layout by itself when x and y are unbound, in the square and with the decay for its size", async () => {
    await drawing({});
    expect(calls).toContain("start");
    expect(uploaded.config).toMatchObject({ spaceSize: 4096, simulationDecay: 600, enableSimulation: true });
  });

  it("stands still when x and y are bound, and runs when simulate says so", async () => {
    await drawing();
    expect(calls).not.toContain("start");
    calls.length = 0;
    await drawing({ x: "lon", y: "lat", simulate: true });
    expect(calls).toContain("start");
  });

  it("centres bound positions' extent in it, at the data's own scale", async () => {
    await drawing();
    // Person at (i, 0) for i < 10, Place at (i, 1) for i < 6: a 9 × 1 extent in a square of 9.
    expect(uploaded.config.spaceSize).toBe(9);
    const ys = new Set(Array.from(uploaded.positions ?? [], (v, i) => (i % 2 ? v : null)).filter((v) => v !== null && !Number.isNaN(v)));
    expect([...ys].sort()).toEqual([4, 5]);
    expect(uploaded.positions?.[2 * 9]).toBe(9);
  });

  it("scales the extent down only past the box the device simulates in", async () => {
    const getContext = HTMLCanvasElement.prototype.getContext as unknown as { mockReturnValue(v: unknown): void };
    getContext.mockReturnValue({ MAX_TEXTURE_SIZE: 3379, getParameter: () => 6, clearColor: () => undefined });
    await drawing();
    expect(uploaded.config.spaceSize).toBe(3);
    expect(uploaded.positions?.[2 * 9]).toBe(3);
  });
});

describe("the camera at load", () => {
  const observed: (() => void)[] = [];
  beforeEach(() => {
    observed.length = 0;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          observed.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
  });
  const resize = async () => {
    for (const callback of observed) callback();
    await frame();
  };

  it("frames the corpus again when the canvas settles its size, as a split panel does after mount", async () => {
    await drawing();
    calls.length = 0;
    await resize();
    expect(calls).toEqual(["fit"]);
  });

  it("frames the corpus once the device is up, since a frame taken before it is taken at no size", async () => {
    let up: () => void = () => {};
    device.ready = () => new Promise<void>((resolve) => (up = resolve));
    await drawing();
    calls.length = 0;
    up();
    await frame();
    expect(calls).toEqual(["fit"]);
  });

  it("stops re-framing when the reader takes the camera, and starts again with Frame", async () => {
    const { renderer } = await drawing();
    (constructed[0]?.onZoomStart as (event: unknown, user: boolean) => void)({}, true);
    calls.length = 0;
    await resize();
    expect(calls).toEqual([]);
    renderer?.frame();
    calls.length = 0;
    await resize();
    expect(calls).toEqual(["fit"]);
  });

  it("locates a vertex by framing it with its neighbours, and a resize does not take that back", async () => {
    const { renderer } = await drawing();
    neighbours.splice(0, neighbours.length, 1, 2);
    calls.length = 0;
    renderer?.reveal(0);
    expect(commands()).toEqual(["frame:0,1,2"]);
    await frame();
    calls.length = 0;
    await resize();
    expect(commands()).toEqual([]);
    neighbours.length = 0;
    renderer?.reveal(1);
    expect(commands()).toEqual(["zoom:1@4 in"]);
  });

  it("frames what is in full colour: the pick within what the filter keeps, else what the filter keeps", async () => {
    const { corpus, crossfilter, renderer, store } = await drawing();
    crossfilter.update(clauseInterval("score", [2, 5], { source: { reset() {} } }));
    await settle(corpus);
    calls.length = 0;
    renderer?.frame();
    // What is kept and placed: Person 1–4, the clause keeping none of Place or Tag.
    expect(commands()).toEqual(["frame:1,2,3,4"]);
    calls.length = 0;
    // Person 0 scores 1: held by the canvas, greyed by the filter, and not framed.
    store.select([0, 1, 2]);
    renderer?.frame();
    expect(commands()).toEqual(["frame:1,2"]);
  });

  it("colours what the tools act on: the canvas's full colour is store.visible(), filtered and picked", async () => {
    const { corpus, crossfilter, store } = await drawing();
    crossfilter.update(clauseInterval("score", [2, 5], { source: { reset() {} } }));
    await settle(corpus);
    // 0 is greyed by the filter and 99 is no vertex at all: neither is in full colour, for either reading.
    store.select([0, 1, 2, 99]);
    await frame();
    expect(store.visible()).toEqual([1, 2]);
    expect(uploaded.config.highlightedPointIndices).toEqual(store.visible());
  });

  it("is not moved by its own fits", async () => {
    await drawing();
    (constructed[0]?.onZoomStart as (event: unknown, user: boolean) => void)({}, false);
    calls.length = 0;
    await resize();
    expect(calls).toEqual(["fit"]);
  });
});

describe("the camera while a layout runs", () => {
  const tick = () => (constructed[0]?.onSimulationTick as (...args: unknown[]) => void)(0.5);
  const later = (ms: number) => vi.spyOn(performance, "now").mockReturnValue(performance.now() + ms);

  it("re-frames the moving points as the layout runs, and once more when it settles", async () => {
    const { renderer } = await drawing();
    renderer?.resume();
    calls.length = 0;
    tick();
    expect(calls).not.toContain("fitView");
    later(2000);
    tick();
    expect(calls).toContain("fitView");
    calls.length = 0;
    (constructed[0]?.onSimulationEnd as () => void)();
    expect(commands()).toEqual(["fitView"]);
  });

  it("waits ten times a re-frame's stall before the next, so a slow readback cannot hold the main thread", async () => {
    const { renderer } = await drawing();
    // Whole milliseconds, so a stall of 2000 is exactly 2000 and ten of them exactly 20,000.
    let clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    const graph = renderer?.graph as unknown as { fitView: () => void };
    const read = graph.fitView;
    // SwiftShader at 206,629 vertices: the readback waits two seconds for the queued steps.
    graph.fitView = () => {
      clock += 2000;
      read();
    };
    renderer?.resume();
    calls.length = 0;
    clock += 900;
    tick();
    expect(count("fitView")).toBe(1);
    clock += 19_999;
    tick();
    expect(count("fitView")).toBe(1);
    clock += 1;
    tick();
    expect(count("fitView")).toBe(2);
    // A new run measures again: a fast readback follows every 900 ms.
    graph.fitView = read;
    renderer?.restart();
    clock += 900;
    tick();
    clock += 900;
    tick();
    expect(count("fitView")).toBe(4);
  });

  it("starts a layout only after the render that uploads its positions, so it has them to follow", async () => {
    const onFailure = vi.fn();
    await drawing({ onFailure });
    expect(calls.indexOf("render", calls.indexOf("positions"))).toBeLessThan(calls.findIndex((call) => /enableSimulation/.test(call)));
    later(2000);
    tick();
    (constructed[0]?.onSimulationEnd as () => void)();
    expect(count("fitView")).toBe(2);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("fails once with graph/no-positions when cosmos.gl has none to read back, and reads no more", async () => {
    const onFailure = vi.fn();
    const { store } = await drawing({ onFailure });
    gpu.unreadable = true;
    later(2000);
    expect(() => tick()).not.toThrow();
    later(4000);
    tick();
    (constructed[0]?.onSimulationEnd as () => void)();
    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure.mock.calls[0]?.[0]).toMatchObject({ name: "Problem", code: "graph/no-positions", cause: expect.any(TypeError) });
    expect(store.getSnapshot().status).toBe("failed");
  });

  it("reads no positions back before the device is up", async () => {
    let up: () => void = () => {};
    device.ready = () => new Promise<void>((resolve) => (up = resolve));
    const { renderer } = await drawing({});
    const graph = renderer?.graph as unknown as { isReady: boolean };
    graph.isReady = false;
    gpu.unreadable = true;
    later(2000);
    tick();
    renderer?.frame();
    expect(count("fitView")).toBe(0);
    gpu.unreadable = false;
    graph.isReady = true;
    up();
    await frame();
    later(4000);
    tick();
    expect(count("fitView")).toBe(1);
  });

  it("leaves the camera to a reader who took it", async () => {
    const { renderer } = await drawing();
    renderer?.resume();
    (constructed[0]?.onZoomStart as (event: unknown, user: boolean) => void)({}, true);
    calls.length = 0;
    later(2000);
    tick();
    (constructed[0]?.onSimulationEnd as () => void)();
    expect(calls).not.toContain("fitView");
  });

  it("fits the points where they are once a layout has moved them", async () => {
    const { renderer } = await drawing();
    renderer?.frame();
    expect(calls.at(-1)).toBe("fit");
    renderer?.resume();
    renderer?.frame();
    expect(calls.at(-1)).toBe("fitView");
  });
});

describe("the live layout", () => {
  it("runs only when asked, from the positions it has, and stops where they are", async () => {
    const { renderer, store } = await drawing();
    expect(calls).not.toContain("start");
    calls.length = 0;
    renderer?.resume();
    expect(calls.find((call) => call.startsWith("config:"))).toMatch(/enableSimulation/);
    expect(calls).toContain("start");
    renderer?.pause();
    expect(commands().at(-1)).toBe("pause");
    store.setOptions({ ...store.getOptions(), sim: { gravity: 0.5 } });
    await frame();
    expect(calls).not.toContain("positions");
  });

  it("starts and stops with the simulate prop, after the first load", async () => {
    const { store } = await drawing();
    calls.length = 0;
    store.setOptions({ ...store.getOptions(), simulate: true });
    expect(calls).toContain("start");
    store.setOptions({ ...store.getOptions(), simulate: false });
    expect(commands().at(-1)).toBe("pause");
  });
});

describe("the renderer's keys", () => {
  it("lists a vertex's neighbours once each, in id order", async () => {
    const { renderer } = await drawing();
    neighbours.push(5, 3, 3, 1);
    expect(renderer?.neighbours(0)).toEqual([1, 3, 5]);
    neighbours.length = 0;
  });

  it("finds the nearest kept, placed vertex the way the key points, and one near the centre with no vertex focused", async () => {
    const { renderer } = await drawing();
    // Person i lies at lon i, lat 0, so the next one right is the next id.
    expect(renderer?.toward(3, [1, 0])).toBe(4);
    expect(renderer?.toward(3, [-1, 0])).toBe(2);
    const first = renderer?.toward(null, [1, 0]) ?? -1;
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(16);
  });

  it("brings a vertex that is out of view into it, and leaves one that is in view alone", async () => {
    const { host, renderer } = await drawing();
    renderer?.show(2);
    expect(calls.filter((call) => call.startsWith("zoom:2"))).toHaveLength(1);
    calls.length = 0;
    Object.defineProperty(host, "clientWidth", { value: 1e6 });
    Object.defineProperty(host, "clientHeight", { value: 1e6 });
    renderer?.show(2);
    expect(calls.filter((call) => call.startsWith("zoom:"))).toHaveLength(0);
  });

  it("pans by moving the camera, which is the reader's from then on", async () => {
    const { renderer } = await drawing();
    calls.length = 0;
    renderer?.pan(80, 0);
    expect(calls).toContain("view");
  });
});

describe("prefers-reduced-motion", () => {
  it("gives the camera a duration of 0, and its usual one otherwise", async () => {
    const { renderer } = await drawing();
    neighbours.push(1);
    renderer?.reveal(0);
    expect(durations.at(-1)).toBe(420);
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    renderer?.reveal(0);
    expect(durations.at(-1)).toBe(0);
    vi.unstubAllGlobals();
    neighbours.length = 0;
  });
});

describe("dragging", () => {
  // A drag moves one node; it holds nothing in place. Pinning was a second state beside the
  // selection that no panel could read.
  it("leaves a dragged node free, with or without a layout running", async () => {
    const { renderer } = await drawing();
    renderer?.resume();
    await frame();
    expect(constructed[0]?.onDragEnd).toBeUndefined();
    expect(calls).not.toContain("pinned");
  });
});

describe("the renderer's lifetime", () => {
  it("gives the context back when the graph goes", () => {
    const device = readFileSync(resolve(process.cwd(), "src/render/webgl.ts"), "utf8");
    expect(device).toContain("WEBGL_lose_context");
    expect(device).toContain("releaseContext(canvas)");
    expect(device.indexOf("graph.destroy()")).toBeLessThan(device.indexOf("releaseContext(canvas)"));
    expect(readFileSync(resolve(process.cwd(), "src/render/renderer.ts"), "utf8")).toContain("holdDevice(graph, host, {");
  });
});

describe("the arrangement outlives the canvas", () => {
  const hook = (at: number, name: string) => constructed[at]?.[name] as (...args: unknown[]) => void;
  /** The canvas goes at 800 × 600, as a host switching views takes it away. */
  function detach(host: HTMLElement, renderer: ReturnType<typeof createRenderer>) {
    Object.defineProperties(host, { clientWidth: { value: 800 }, clientHeight: { value: 600 } });
    renderer?.destroy();
  }
  async function reattach(store: ReturnType<typeof createGraph>) {
    calls.length = 0;
    const renderer = createRenderer(document.createElement("div"), store);
    await frame();
    return renderer;
  }

  it("leaves the points and the camera to the next canvas, which starts settled from them and runs nothing", async () => {
    const { host, renderer, store } = await drawing({});
    hook(0, "onSimulationEnd")();
    const moved = Array.from(Float32Array.from(uploaded.positions ?? [], (v) => v + 1));
    detach(host, renderer);
    expect(Array.from(store.getSnapshot().arrangement?.positions ?? [])).toEqual(moved);
    expect(store.getSnapshot().arrangement?.view).toEqual({ center: [4, 3], zoom: 1 });
    await reattach(store);
    expect(Array.from(uploaded.positions ?? [])).toEqual(moved);
    expect(uploaded.view).toEqual({ center: [4, 3], zoom: 1 });
    expect(commands()).not.toContain("start");
    expect(commands()).not.toContain("fitView");
    expect(constructed[1]).toMatchObject({ enableSimulation: false });
    expect(calls.some((call) => /enableSimulation/.test(call))).toBe(false);
    expect(store.getSnapshot().motion).toBe("settled");
  });

  it("keeps a paused layout paused, and resumes a running one with a reheat", async () => {
    const paused = await drawing({});
    paused.renderer?.pause();
    detach(paused.host, paused.renderer);
    await reattach(paused.store);
    expect(commands()).not.toContain("start");
    expect(paused.store.getSnapshot().motion).toBe("paused");

    const running = await drawing({});
    expect(running.store.getSnapshot().motion).toBe("running");
    detach(running.host, running.renderer);
    await reattach(running.store);
    expect(commands()).toContain("start");
    expect(running.store.getSnapshot().motion).toBe("running");
  });

  it("drops what it kept when the geometry changes, and the next canvas places the new one", async () => {
    const { corpus, host, renderer, store } = await drawing({});
    detach(host, renderer);
    store.setOptions({ ...store.getOptions(), x: "lon", y: "lat" });
    await settle(corpus);
    expect(store.getSnapshot().arrangement).toBeNull();
    await reattach(store);
    expect(uploaded.positions?.[2 * 9]).toBe(9);
    expect(commands()).not.toContain("view");
  });

  it("keeps nothing it never drew, and no camera from a canvas with no size", async () => {
    const { store } = await drawing({ from: null, engine: null, onFailure: () => {} });
    const early = createRenderer(document.createElement("div"), store);
    early?.destroy();
    expect(store.getSnapshot().arrangement).toBeNull();

    const sized = await drawing({});
    sized.renderer?.destroy();
    expect(sized.store.getSnapshot().arrangement?.positions).toBeInstanceOf(Float32Array);
    expect(sized.store.getSnapshot().arrangement?.view).toBeNull();
  });
});

describe("the renderer's failures", () => {
  function mounted() {
    const onFailure = vi.fn();
    const store = createGraph({ from: null, engine: null, onFailure });
    const host = document.createElement("div");
    const renderer = createRenderer(host, store);
    return { host, onFailure, renderer, store };
  }

  it("asks for a restore when the context is lost, and fails nothing while it waits", async () => {
    const onRestore = vi.fn();
    const onFailure = vi.fn();
    const store = createGraph({ from: null, engine: null, onFailure });
    const host = document.createElement("div");
    createRenderer(host, store, { onRestore });
    await Promise.resolve();
    const lost = new Event("webglcontextlost", { cancelable: true });
    const canvas = host.querySelector("canvas");
    canvas?.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(onFailure).not.toHaveBeenCalled();
    expect(onRestore).not.toHaveBeenCalled();
    canvas?.dispatchEvent(new Event("webglcontextrestored"));
    await frame();
    expect(onRestore).toHaveBeenCalledOnce();
    expect(onFailure).not.toHaveBeenCalled();
    expect(store.getSnapshot().status).not.toBe("failed");
  });

  it("fails with graph/context-lost when the browser does not return the context within 5 s", async () => {
    vi.useFakeTimers();
    try {
      const { host, onFailure, store } = mounted();
      await vi.advanceTimersByTimeAsync(0);
      host.querySelector("canvas")?.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
      await vi.advanceTimersByTimeAsync(4_999);
      expect(onFailure).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(isProblem(onFailure.mock.calls[0]?.[0], "graph/context-lost")).toBe(true);
      expect(store.getSnapshot().status).toBe("failed");
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops waiting for a context once destroyed", async () => {
    vi.useFakeTimers();
    try {
      const { host, onFailure, renderer } = mounted();
      await vi.advanceTimersByTimeAsync(0);
      host.querySelector("canvas")?.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
      renderer?.destroy();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(onFailure).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("builds a new cosmos.gl over the store's geometry and encoding when the context returns, and runs a layout again", async () => {
    const corpus = await attach();
    const onFailure = vi.fn();
    const { result } = renderHook(() => useGraph({ from: corpus.from, engine: corpus.engine, fill: "team", onFailure }));
    const host = document.createElement("div");
    const detach = internalsOf(result.current).attach(host);
    await settle(corpus);
    await frame();
    const { store } = internalsOf(result.current);
    expect(constructed).toHaveLength(1);
    expect(store.getSnapshot().motion).toBe("running");
    host.querySelector("canvas")?.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    // The lost context's positions are not read back: the GPU's copy is gone.
    expect(store.getSnapshot().arrangement).toBeNull();
    calls.length = 0;
    host.querySelector("canvas")?.dispatchEvent(new Event("webglcontextrestored"));
    await frame();
    await frame();
    expect(constructed).toHaveLength(2);
    expect(count("positions")).toBe(1);
    expect(count("colors")).toBe(1);
    expect(count("start")).toBe(1);
    expect(store.getSnapshot().motion).toBe("running");
    expect(store.getSnapshot().status).toBe("idle");
    expect(onFailure).not.toHaveBeenCalled();
    detach();
  });

  it("fails with graph/no-webgl and when the deadline fired, if WebGL exists but no device ever comes up", async () => {
    vi.useFakeTimers();
    try {
      device.ready = () => new Promise(() => {});
      const { onFailure, store } = mounted();
      await vi.advanceTimersByTimeAsync(9_999);
      expect(onFailure).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(onFailure).toHaveBeenCalledOnce();
      expect(onFailure.mock.calls[0]?.[0]).toMatchObject({ name: "Problem", code: "graph/no-webgl", data: { after: 10_000 } });
      expect(store.getSnapshot().status).toBe("failed");
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails with graph/no-webgl, the rejection as its cause, when the device refuses", async () => {
    const refused = new Error("adapter lost");
    device.ready = () => Promise.reject(refused);
    const { onFailure, store } = mounted();
    await Promise.resolve();
    await Promise.resolve();
    expect(onFailure.mock.calls[0]?.[0]).toMatchObject({ code: "graph/no-webgl", cause: refused });
    expect(store.getSnapshot().status).toBe("failed");
  });

  it("reports nothing once destroyed, though the deadline would have fired", async () => {
    vi.useFakeTimers();
    try {
      device.ready = () => new Promise(() => {});
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ isContextLost: () => true, clearColor: () => undefined, getParameter: () => null } as unknown as RenderingContext);
      const { onFailure, renderer } = mounted();
      renderer?.destroy();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(onFailure).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("an attach that throws reaches onFailure as the thrown value, and marks the graph failed", () => {
    const broken = new Error("render threw");
    device.broken = broken;
    const onFailure = vi.fn();
    const { result } = renderHook(() => useGraph({ from: null, engine: null, onFailure }));
    const { attach } = internalsOf(result.current);
    expect(() => attach(document.createElement("div"))).not.toThrow();
    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure.mock.calls[0]?.[0]).toBe(broken);
    expect(result.current.getState().status).toBe("failed");
  });
});
