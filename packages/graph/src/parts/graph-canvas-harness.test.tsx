import { GraphCanvasHarness } from "@kanzo-tech/testing";
import { dom } from "@kanzo-tech/testing/dom";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attach, settle } from "../../test/corpus";
import { GraphRoot } from "../react/graph-root";
import { GraphCanvas } from "./graph-canvas";
import { GraphCounts } from "./graph-counts";

/**
 * `GraphCanvasHarness` over jsdom, which has no WebGL: what it can see here is the ARIA and what the
 * element says of where it draws, and that a canvas which could not draw is reported as a failure
 * rather than as ready.
 * The gestures and the camera need a GPU, and are held by the end-to-end suite in `packages/testing`.
 */

// jsdom has no ResizeObserver, and the canvas's overlays measure it with one.
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GraphCanvas, as a test reads it", () => {
  it("says where it draws on its element, in every page, and takes it off when it unmounts", async () => {
    const corpus = await attach();
    const { container, unmount } = render(
      <GraphRoot from={corpus.from} engine={corpus.engine} onFailure={() => {}}>
        <GraphCanvas id="archive" />
      </GraphRoot>,
    );
    const canvas = container.querySelector("[data-frame]") as Element & { screenOf?(vertex: number): [number, number] };
    // No environment was made: nothing looks for a test. jsdom draws nothing, so nowhere yet.
    expect(canvas.screenOf?.(0)).toEqual([Number.NaN, Number.NaN]);
    unmount();
    expect(canvas.screenOf).toBeUndefined();
  });

  it("ready() rejects a canvas that finished loading without drawing a frame, as one with no WebGL does", async () => {
    const env = dom();
    const corpus = await attach();
    render(
      <GraphRoot from={corpus.from} engine={corpus.engine} onFailure={() => {}}>
        <GraphCanvas />
      </GraphRoot>,
    );
    const graph = await env.getHarness(GraphCanvasHarness);
    await act(() => settle(corpus));
    await expect(graph.ready()).rejects.toThrow(/without drawing a frame/);
    expect(await graph.frames()).toBe(0);
  });

  it("reads GraphCounts' sentence once it has loaded", async () => {
    const env = dom();
    const corpus = await attach();
    render(
      <GraphRoot from={corpus.from} engine={corpus.engine} onFailure={() => {}} x="lon" y="lat">
        <GraphCanvas>
          <GraphCounts />
        </GraphCanvas>
      </GraphRoot>,
    );
    const graph = await env.getHarness(GraphCanvasHarness);
    await act(() => settle(corpus));
    expect(await graph.counts()).toMatch(/^16 of 20 nodes placed · \S+ of 20 edges$/);
  });
});
