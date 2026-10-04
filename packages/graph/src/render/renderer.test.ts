import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Selection, clauseInterval } from "@kanzo-tech/mosaic";
import { attach, settle } from "../../test/corpus";
import { GraphError } from "../core/error";
import type { GraphOptions } from "../core/state";
import { createGraph } from "../core/store";
import { internalsOf, useGraph } from "../react/use-graph";

/**
 * The renderer's frame, against a cosmos.gl that records what it is told. What this cannot prove is
 * that cosmos.gl draws what it was given — the browser does, and `/docs/graph/benchmarks` measures it.
 */

const calls: string[] = [];
const constructed: Record<string, unknown>[] = [];
const uploaded: { positions: Float32Array | null; config: Record<string, unknown>; view: unknown } = {
  positions: null,
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
    getNeighboringPointIndices = () => [];
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
    setPointColors = () => calls.push("colors");
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
  constructed.length = 0;
  uploaded.positions = null;
  uploaded.config = {};
  uploaded.view = null;
  device.ready = () => Promise.resolve();
  device.broken = undefined;
  Object.assign(gpu, { pending: false, buffer: false, unreadable: false });
  vi.stubGlobal("requestAnimationFrame", (run: () => void) => setTimeout(run, 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  // A context already lost, so a destroyed canvas has nothing to give back.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ isContextLost: () => true } as unknown as RenderingContext);
});
afterEach(() => vi.restoreAllMocks());

/** The fixture's corpus drawn at its `lon`/`lat` — bound, so nothing runs unless a test asks. */
async function drawing(over: Partial<GraphOptions> = { x: "lon", y: "lat" }) {
  const corpus = await attach();
  const crossfilter = Selection.crossfilter();
  const store = createGraph({ from: corpus.from, coordinator: corpus.coordinator, fill: "team", filterBy: crossfilter, onFailure: () => {}, ...over });
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

  it("greys out a filter with config alone: no upload, no render, links said out loud", async () => {
    const { corpus, crossfilter } = await drawing();
    calls.length = 0;
    crossfilter.update(clauseInterval("score", [2, 5], { source: { reset() {} } }));
    await settle(corpus);
    await frame();
    expect(commands()).toEqual([]);
    expect(uploaded.config.highlightedPointIndices).toEqual([1, 2, 3, 4, ...Array.from({ length: 10 }, (_, i) => 10 + i)]);
    // knows 1→2, 2→3, 3→4 and livesIn 1→11 … 4→14; tagged 0→16 has an end the filter greyed.
    expect(uploaded.config.highlightedLinkIndices).toHaveLength(7);
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
    getContext.mockReturnValue({ MAX_TEXTURE_SIZE: 3379, getParameter: () => 6 });
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

  it("stops re-framing when the reader takes the camera, and starts again with Fit", async () => {
    const { renderer } = await drawing();
    (constructed[0]?.onZoomStart as (event: unknown, user: boolean) => void)({}, true);
    calls.length = 0;
    await resize();
    expect(calls).toEqual([]);
    renderer?.fit();
    calls.length = 0;
    await resize();
    expect(calls).toEqual(["fit"]);
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
    expect(onFailure.mock.calls[0]?.[0]).toMatchObject({ name: "GraphError", code: "graph/no-positions", cause: expect.any(TypeError) });
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
    renderer?.fit();
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
    renderer?.fit();
    expect(calls.at(-1)).toBe("fit");
    renderer?.resume();
    renderer?.fit();
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
    expect(readFileSync(resolve(process.cwd(), "src/render/renderer.ts"), "utf8")).toContain("holdDevice(graph, host, fail, camera.ready)");
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
    const { store } = await drawing({ from: null, coordinator: null, onFailure: () => {} });
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
    const store = createGraph({ from: null, coordinator: null, onFailure });
    const host = document.createElement("div");
    const renderer = createRenderer(host, store);
    return { host, onFailure, renderer, store };
  }

  it("fails with graph/context-lost, and asks for a restore, when the context is lost", async () => {
    const { host, onFailure, store } = mounted();
    await Promise.resolve();
    const lost = new Event("webglcontextlost", { cancelable: true });
    host.querySelector("canvas")?.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(onFailure.mock.calls[0]?.[0]).toBeInstanceOf(GraphError);
    expect(onFailure.mock.calls[0]?.[0]).toMatchObject({ code: "graph/context-lost" });
    expect(store.getSnapshot().status).toBe("failed");
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
      expect(onFailure.mock.calls[0]?.[0]).toMatchObject({ name: "GraphError", code: "graph/no-webgl", data: { after: 10_000 } });
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
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ isContextLost: () => true } as unknown as RenderingContext);
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
    const { result } = renderHook(() => useGraph({ from: null, coordinator: null, onFailure }));
    const { attach } = internalsOf(result.current);
    expect(() => attach(document.createElement("div"))).not.toThrow();
    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure.mock.calls[0]?.[0]).toBe(broken);
    expect(result.current.getState().status).toBe("failed");
  });
});
