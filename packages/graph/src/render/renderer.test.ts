import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Selection, clauseInterval } from "@kanzo-tech/mosaic";
import { fakeCorpus } from "../../test/corpus";
import { graphClient } from "../core/filter";
import { GraphError } from "../core/error";
import { createGraph } from "../core/store";
import { internalsOf, useGraph } from "../react/use-graph";

/**
 * The renderer's frame, against a cosmos.gl that records what it is told. What this cannot prove is
 * that cosmos.gl draws what it was given — the browser does, and `/docs/graph/benchmarks` measures it.
 */

const calls: string[] = [];
const constructed: Record<string, unknown>[] = [];
/** What the next graph's `ready` is, and whether its first `render()` throws. */
const device: { ready: () => Promise<void>; broken: unknown } = { ready: () => Promise.resolve(), broken: undefined };

vi.mock("@cosmos.gl/graph", () => ({
  Graph: class {
    constructor(host: HTMLElement, config: Record<string, unknown>) {
      constructed.push(config);
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
    getNeighboringPointIndices = () => [];
    destroy = () => calls.push("destroy");
    render = () => {
      if (device.broken !== undefined) throw device.broken;
      calls.push("render");
    };
    setPointPositions = () => calls.push("positions");
    setLinks = () => calls.push("links");
    setPointColors = () => calls.push("colors");
    setPointSizes = () => calls.push("sizes");
    setPointShapes = () => calls.push("shapes");
    setLinkColors = () => calls.push("linkColors");
    setLinkWidths = () => calls.push("linkWidths");
    setPinnedPoints = () => calls.push("pinned");
    setConfigPartial = (config: Record<string, unknown>) => calls.push(`config:${Object.keys(config).join(",")}`);
    fitViewByPointPositions = () => calls.push("fit");
    start = () => calls.push("start");
    pause = () => calls.push("pause");
    unpause = () => calls.push("unpause");
  },
}));

const { createRenderer } = await import("./renderer");

const frame = () => new Promise((resolve) => setTimeout(resolve, 20));
const count = (name: string) => calls.filter((call) => call === name).length;

beforeEach(() => {
  calls.length = 0;
  constructed.length = 0;
  device.ready = () => Promise.resolve();
  device.broken = undefined;
  vi.stubGlobal("requestAnimationFrame", (run: () => void) => setTimeout(run, 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as RenderingContext);
});
afterEach(() => vi.restoreAllMocks());

async function drawing() {
  const fake = fakeCorpus();
  const crossfilter = Selection.crossfilter();
  const store = createGraph({ corpus: fake.corpus, fill: "cluster_id", filterBy: crossfilter, r: "degree", onFailure: () => {} });
  const host = document.createElement("div");
  const renderer = createRenderer(host, store);
  await fake.settle();
  await frame();
  return { crossfilter, fake, renderer, store };
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

  it("uploads positions alone for a filter", async () => {
    const { crossfilter, fake } = await drawing();
    calls.length = 0;
    crossfilter.update(clauseInterval("degree", [2, 5], { source: graphClient() }));
    await fake.settle();
    await frame();
    expect(calls.filter((call) => !call.startsWith("config:"))).toEqual(["positions", "render"]);
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

  it("frames the corpus's extent before it draws anything, and only once", async () => {
    const { store } = await drawing();
    const framed = calls.indexOf("config:spaceSize");
    expect(framed).toBeGreaterThanOrEqual(0);
    expect(framed).toBeLessThan(calls.indexOf("positions"));
    expect(calls.indexOf("fit")).toBeLessThan(calls.indexOf("positions"));
    store.setOptions({ ...store.getOptions(), r: "cluster_id" });
    await frame();
    expect(calls.filter((call) => call === "config:spaceSize")).toHaveLength(1);
  });

  it("constructs cosmos.gl with no simulation and no transition", async () => {
    await drawing();
    expect(constructed).toHaveLength(1);
    expect(constructed[0]).toMatchObject({ enableSimulation: false, transitionDuration: 0 });
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

describe("the live layout", () => {
  it("runs only when asked, from the positions it has, and stops where they are", async () => {
    const { renderer, store } = await drawing();
    expect(calls).not.toContain("start");
    calls.length = 0;
    renderer?.resume();
    expect(calls.find((call) => call.startsWith("config:"))).toMatch(/enableSimulation/);
    expect(calls).toContain("start");
    renderer?.pause();
    expect(calls.at(-1)).toBe("pause");
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
    expect(calls.at(-1)).toBe("pause");
  });
});

describe("the renderer's lifetime", () => {
  const SOURCE = readFileSync(resolve(process.cwd(), "src/render/renderer.ts"), "utf8");

  it("gives the context back when the graph goes", () => {
    expect(readFileSync(resolve(process.cwd(), "src/render/webgl.ts"), "utf8")).toContain("WEBGL_lose_context");
    expect(SOURCE).toContain("releaseContext(canvas)");
    expect(SOURCE.indexOf("graph.destroy()")).toBeLessThan(SOURCE.indexOf("releaseContext(canvas)"));
  });

});

describe("the renderer's failures", () => {
  function mounted() {
    const onFailure = vi.fn();
    const store = createGraph({ corpus: null, onFailure });
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
    const { result } = renderHook(() => useGraph({ corpus: null, onFailure }));
    const { attach } = internalsOf(result.current);
    expect(() => attach(document.createElement("div"))).not.toThrow();
    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure.mock.calls[0]?.[0]).toBe(broken);
    expect(result.current.getState().status).toBe("failed");
  });
});
