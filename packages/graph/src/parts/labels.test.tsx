import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attach, settle } from "../../test/corpus";
import { readTitles } from "../core/source";
import { GraphRoot } from "../react/graph-root";
import type { LabelLevel } from "../render/graph-looks";
import { GraphCanvas } from "./graph-canvas";
import { cellsIn } from "./labels";

/**
 * **No label level is an unbounded set** (Kanzo-Tech/ui#69). A graph the size Discover draws, a
 * surface of a known size, and a renderer whose sample claims every vertex is in view — more than
 * cosmos.gl's grid can return, so the bound is the canvas's and not the GPU's good manners. What is
 * counted is what a reader pays for: label elements mounted, and ids handed to the title read.
 */

const PEOPLE = 327_000;
const [WIDTH, HEIGHT] = [800, 600];
const IN_VIEW = cellsIn(WIDTH, HEIGHT);

vi.mock("../core/source", async (actual) => {
  const module = await actual<typeof import("../core/source")>();
  return { ...module, readTitles: vi.fn(module.readTitles) };
});

/**
 * A cosmos.gl that says every vertex is in view, last first — Top took the first of the ties — and
 * puts each at the origin.
 */
const graph = {
  getSampledPointPositionsMap: () => new Map(Array.from({ length: PEOPLE + 20 }, (_, i) => [PEOPLE + 19 - i, [0, 0]])),
  trackPointPositionsByIndices: () => {},
  getTrackedPointPositionsMap: () => new Map(),
  spaceToScreenPosition: (point: [number, number]) => point,
  getZoomLevel: () => 1,
};

vi.mock("../react/use-graph", async (actual) => {
  const module = await actual<typeof import("../react/use-graph")>();
  const faked = new WeakMap<object, ReturnType<typeof module.internalsOf>>();
  const renderer = () => ({ graph, repaint() {} }) as never;
  const internalsOf = (api: Parameters<typeof module.internalsOf>[0]) => {
    if (!faked.has(api)) faked.set(api, { ...module.internalsOf(api), renderer });
    return faked.get(api) as ReturnType<typeof module.internalsOf>;
  };
  return { ...module, internalsOf };
});

const mounted = () => document.querySelectorAll("[data-slot=graph-canvas-label]").length;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(WIDTH);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(HEIGHT);
  vi.mocked(readTitles).mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("label levels over a large graph", () => {
  it.each([
    ["visible", 150 + Math.min(100, IN_VIEW)],
    ["all", 150 + IN_VIEW],
  ] as [LabelLevel, number][])("mounts no more labels at %s than the view holds", async (level, bound) => {
    const corpus = await attach(PEOPLE);
    render(
      <GraphRoot from={corpus.from} coordinator={corpus.coordinator} look={{ labels: level }} onFailure={() => {}} title="name">
        <GraphCanvas />
      </GraphRoot>,
    );
    await act(() => settle(corpus));
    // Top is down, then the view's sample adds to it once the camera has rested.
    await waitFor(() => expect(mounted()).toBeGreaterThan(150), { timeout: 5000 });
    await act(() => settle(corpus));
    expect(mounted()).toBeLessThanOrEqual(bound);
    const asked = vi.mocked(readTitles).mock.calls.map(([, , vertices]) => vertices.length);
    expect(asked.length).toBeGreaterThan(0);
    expect(Math.max(...asked), "ids in one title read").toBeLessThanOrEqual(bound);
  }, 60_000);
});
