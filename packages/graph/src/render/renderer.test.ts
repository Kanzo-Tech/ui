import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Selection, clauseInterval } from "@kanzo-tech/mosaic";
import { fakeCorpus } from "../../test/corpus";
import { graphClient } from "../core/filter";
import { createGraph } from "../core/store";

/**
 * The renderer's frame, against a cosmos.gl that records what it is told. What this cannot prove is
 * that cosmos.gl draws what it was given — the browser does, and `/docs/graph/benchmarks` measures it.
 */

const calls: string[] = [];
const constructed: Record<string, unknown>[] = [];

vi.mock("@cosmos.gl/graph", () => ({
  Graph: class {
    constructor(_host: HTMLElement, config: Record<string, unknown>) {
      constructed.push(config);
    }
    ready = Promise.resolve();
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
    render = () => calls.push("render");
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

  it("hears a lost context and asks for a restore", () => {
    expect(SOURCE).toMatch(/graph\.ready\.then\(\(\) => \{\n\s+if \(!destroyed\) host\.querySelector\("canvas"\)\?\.addEventListener/);
    expect(SOURCE).toContain("event.preventDefault()");
    expect(SOURCE).toContain('removeEventListener("webglcontextlost"');
  });
});
