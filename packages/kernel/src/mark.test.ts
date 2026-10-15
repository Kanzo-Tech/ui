import { afterEach, describe, expect, it, vi } from "vitest";
import { mark } from "./index.js";

afterEach(() => void vi.unstubAllGlobals());

describe("mark", () => {
  it("writes a kanzo:<area>:<name> measure from start, leaving the end to the API, with its detail", () => {
    const measure = vi.fn();
    vi.stubGlobal("performance", { measure });
    mark("llm:load", 10, { model: "m" });
    expect(measure).toHaveBeenCalledWith("kanzo:llm:load", { start: 10, detail: { model: "m" } });
  });

  it("appears in the real timeline, starting at start, with a cloned detail", () => {
    const start = performance.now();
    mark("test:real", start, { n: 1 });
    const [entry] = performance.getEntriesByName("kanzo:test:real", "measure") as (PerformanceEntry & { detail: unknown })[];
    expect(entry?.startTime).toBe(start);
    expect(entry?.duration).toBeGreaterThanOrEqual(0);
    expect(entry?.detail).toEqual({ n: 1 });
  });

  it("loses the span, and nothing else, when the detail cannot be structured-cloned", () => {
    expect(() => mark("test:clone", performance.now(), { f: () => 1 })).not.toThrow();
    expect(performance.getEntriesByName("kanzo:test:clone", "measure")).toHaveLength(0);
  });

  it("loses the span and nothing else when the browser throws or has no API", () => {
    vi.stubGlobal("performance", { measure: () => { throw new Error("no"); } });
    expect(() => mark("a:b", 0)).not.toThrow();
    vi.stubGlobal("performance", undefined);
    expect(() => mark("a:b", 0)).not.toThrow();
  });
});
