import { render, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fakeCorpus } from "../../test/corpus";
import { GraphCanvas } from "../parts/graph-canvas";
import { GraphRoot, useGraphContext } from "./graph-root";
import { useGraph } from "./use-graph";

/**
 * The adapter: the store's lifetime in React, and the renderer's in the element. jsdom has no WebGL,
 * which is what makes the renderer's construction countable — it declines once per build, through
 * `onFailure`.
 */

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
  },
);

describe("GraphRoot and GraphCanvas", () => {
  it("declines in an environment with no WebGL, and says so once", () => {
    const onFailure = vi.fn();
    render(
      <GraphRoot corpus={null} onFailure={onFailure}>
        <GraphCanvas />
      </GraphRoot>,
    );
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(String(onFailure.mock.calls[0]?.[0])).toMatch(/WebGL/i);
  });

  it("does not rebuild the renderer because a callback changed identity", () => {
    const calls: string[] = [];
    const tree = (tag: string) => (
      <GraphRoot corpus={null} onFailure={(message) => calls.push(`${tag}:${message}`)}>
        <GraphCanvas />
      </GraphRoot>
    );
    const { rerender } = render(tree("a"));
    rerender(tree("b"));
    rerender(tree("c"));
    expect(calls).toHaveLength(1);
  });

  it("gives its parts the api through the context, and refuses outside a root", () => {
    const seen: unknown[] = [];
    function Part() {
      seen.push(useGraphContext().total);
      return null;
    }
    const { corpus } = fakeCorpus();
    render(
      <GraphRoot corpus={corpus} onFailure={() => {}}>
        <Part />
      </GraphRoot>,
    );
    expect(seen.at(-1)).toBe(16);
    expect(() => renderHook(() => useGraphContext())).toThrow(/inside a <GraphRoot>/);
  });
});

describe("useGraph", () => {
  it("does not reach setOptions on a render that changed no prop", () => {
    const { corpus } = fakeCorpus();
    const look = { vignette: true };
    const { rerender, result } = renderHook(
      ({ tag }: { tag: string }) => useGraph({ corpus, fill: "cluster_id", look, onFailure: () => void tag }),
      { initialProps: { tag: "a" } },
    );
    const options = result.current.options;
    rerender({ tag: "b" });
    rerender({ tag: "c" });
    expect(result.current.options).toBe(options);
  });

  it("hands the store a new binding when a prop moves", () => {
    const fake = fakeCorpus();
    const { rerender } = renderHook(({ fill }: { fill: string }) => useGraph({ corpus: fake.corpus, fill, onFailure: () => {} }), {
      initialProps: { fill: "cluster_id" },
    });
    rerender({ fill: "degree" });
    expect(fake.scans.at(-1)?.select).toContain("degree");
  });
});
