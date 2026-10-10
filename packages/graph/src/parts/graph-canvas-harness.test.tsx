import { GraphCanvasHarness, type KanzoTestingHook } from "@kanzo-tech/testing";
import { dom } from "@kanzo-tech/testing/dom";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attach, settle } from "../../test/corpus";
import { GraphRoot } from "../react/graph-root";
import { GraphCanvas } from "./graph-canvas";
import { GraphCounts } from "./graph-counts";

/**
 * `GraphCanvasHarness` over jsdom, which has no WebGL: what it can see here is the ARIA and the
 * registration, and that a canvas which could not draw is reported as a failure rather than as ready.
 * The gestures and the camera need a GPU, and are held by the end-to-end suite in `packages/testing`.
 */

const hook = () => (globalThis as { __KANZO_TESTING__?: KanzoTestingHook }).__KANZO_TESTING__;

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
  delete (globalThis as { __KANZO_TESTING__?: KanzoTestingHook }).__KANZO_TESTING__;
});

describe("GraphCanvas, as a test reads it", () => {
  it("registers with the test hook under its id when one is installed, and lets go of it when it unmounts", async () => {
    dom();
    const corpus = await attach();
    const { unmount } = render(
      <GraphRoot from={corpus.from} coordinator={corpus.coordinator} onFailure={() => {}}>
        <GraphCanvas id="archive" />
      </GraphRoot>,
    );
    expect([...(hook()?.graphs.keys() ?? [])]).toEqual(["archive"]);
    expect(hook()?.graphs.get("archive")?.screenOf(0)).toEqual([Number.NaN, Number.NaN]);
    unmount();
    expect(hook()?.graphs.size).toBe(0);
  });

  it("registers nothing when no test installed the hook", async () => {
    const corpus = await attach();
    const { container } = render(
      <GraphRoot from={corpus.from} coordinator={corpus.coordinator} onFailure={() => {}}>
        <GraphCanvas />
      </GraphRoot>,
    );
    expect(hook()).toBeUndefined();
    expect(container.querySelector("[data-frame]")?.getAttribute("data-frame")).toBe("0");
  });

  it("ready() rejects a canvas that finished loading without drawing a frame, as one with no WebGL does", async () => {
    const env = dom();
    const corpus = await attach();
    render(
      <GraphRoot from={corpus.from} coordinator={corpus.coordinator} onFailure={() => {}}>
        <GraphCanvas />
      </GraphRoot>,
    );
    const graph = await env.harness(GraphCanvasHarness);
    await act(() => settle(corpus));
    await expect(graph.ready()).rejects.toThrow(/without drawing a frame/);
    expect(await graph.frames()).toBe(0);
  });

  it("reads GraphCounts' sentence once it has loaded", async () => {
    const env = dom();
    const corpus = await attach();
    render(
      <GraphRoot from={corpus.from} coordinator={corpus.coordinator} onFailure={() => {}} x="lon" y="lat">
        <GraphCanvas>
          <GraphCounts />
        </GraphCanvas>
      </GraphRoot>,
    );
    const graph = await env.harness(GraphCanvasHarness);
    await act(() => settle(corpus));
    expect(await graph.counts()).toMatch(/^16 of 20 nodes placed · \S+ of 20 edges$/);
  });
});
