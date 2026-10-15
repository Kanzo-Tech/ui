import { afterEach, describe, expect, it, vi } from "vitest";
import { mark } from "./index.js";

afterEach(() => void vi.unstubAllGlobals());

describe("mark", () => {
  it("writes a kanzo:-prefixed measure from start to now, with its detail", () => {
    const measure = vi.fn();
    vi.stubGlobal("performance", { measure, now: () => 42 });
    mark("llm:load", 10, { model: "m" });
    expect(measure).toHaveBeenCalledWith("kanzo:llm:load", { start: 10, end: 42, detail: { model: "m" } });
  });

  it("appears in the real timeline", () => {
    const start = performance.now();
    mark("test:real", start);
    expect(performance.getEntriesByName("kanzo:test:real", "measure")).toHaveLength(1);
  });

  it("loses the span and nothing else when the browser throws or has no API", () => {
    vi.stubGlobal("performance", { measure: () => { throw new Error("no"); }, now: () => 1 });
    expect(() => mark("a:b", 0)).not.toThrow();
    vi.stubGlobal("performance", undefined);
    expect(() => mark("a:b", 0)).not.toThrow();
  });
});
