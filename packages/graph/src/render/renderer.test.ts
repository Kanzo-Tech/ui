import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCorpus } from "../../test/corpus";
import { createGraph } from "../core/store";

/**
 * The renderer's frame, against a cosmos.gl that records what it is told. What this cannot prove is
 * that cosmos.gl draws what it was given — the browser does, and `/docs/graph/benchmarks` measures it.
 */

const calls: string[] = [];

vi.mock("@cosmos.gl/graph", () => ({
  Graph: class {
    ready = Promise.resolve();
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
  },
}));

const { createRenderer } = await import("./renderer");

const frame = () => new Promise((resolve) => setTimeout(resolve, 20));
const count = (name: string) => calls.filter((call) => call === name).length;

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal("requestAnimationFrame", (run: () => void) => setTimeout(run, 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as RenderingContext);
});
afterEach(() => vi.restoreAllMocks());

async function drawing() {
  const fake = fakeCorpus();
  const store = createGraph({ corpus: fake.corpus, fill: "cluster_id", r: "degree", onFailure: () => {} });
  const host = document.createElement("div");
  host.getBoundingClientRect = () => ({ width: 300, height: 100 }) as DOMRect;
  const renderer = createRenderer(host, store);
  await fake.settle();
  await frame();
  return { fake, renderer, store };
}

describe("the renderer's frame", () => {
  it("uploads each buffer once for a change of tiles, and renders once", async () => {
    await drawing();
    expect(count("positions")).toBe(1);
    expect(count("links")).toBe(1);
    expect(count("colors")).toBe(1);
    // One from the frame; the other is the first paint of the background before any tile.
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

  it("uploads nothing when an update selects the same visible set", async () => {
    const { store } = await drawing();
    calls.length = 0;
    store.setViewport({ xMin: 0, xMax: 3, yMin: 0, yMax: 1 });
    store.setViewport({ xMin: 0, xMax: 3, yMin: 0, yMax: 1 });
    await frame();
    expect(calls.filter((call) => call !== "render")).toEqual([]);
    expect(count("render")).toBe(0);
  });

  it("frames the corpus's extent before it reads anything, and only once", async () => {
    const { store } = await drawing();
    const framed = calls.indexOf("config:spaceSize");
    expect(framed).toBeGreaterThanOrEqual(0);
    expect(framed).toBeLessThan(calls.indexOf("positions"));
    expect(calls.indexOf("fit")).toBeLessThan(calls.indexOf("positions"));
    store.setViewport({ xMin: 4, xMax: 8, yMin: 0, yMax: 1 });
    await frame();
    expect(calls.filter((call) => call === "config:spaceSize")).toHaveLength(1);
  });

  it("sets the selection as config and uploads no buffer", async () => {
    const { store } = await drawing();
    calls.length = 0;
    store.select(null);
    store.focus(null);
    await frame();
    expect(calls).not.toContain("positions");
    expect(calls).not.toContain("colors");
  });
});

describe("the renderer's lifetime", () => {
  const SOURCE = readFileSync(resolve(process.cwd(), "src/render/renderer.ts"), "utf8");

  it("gives the context back when the graph goes", () => {
    expect(SOURCE).toContain("WEBGL_lose_context");
    expect(SOURCE).toContain("releaseContext(canvas)");
    expect(SOURCE.indexOf("graph.destroy()")).toBeLessThan(SOURCE.indexOf("releaseContext(canvas)"));
  });

  it("hears a lost context and asks for a restore", () => {
    expect(SOURCE).toMatch(/whenReady\(graph, \(\) => \{\n\s+host\.querySelector\("canvas"\)\?\.addEventListener/);
    expect(SOURCE).toContain("event.preventDefault()");
    expect(SOURCE).toContain('removeEventListener("webglcontextlost"');
  });
});
