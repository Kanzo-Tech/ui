import { act, render, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fakeCorpus } from "../../test/corpus";
import { GraphError } from "../core/error";
import { GraphCanvas } from "../parts/graph-canvas";
import { GraphRoot, useGraphContext } from "./graph-root";
import { internalsOf, useGraph } from "./use-graph";
import { useGraphState } from "./use-graph-state";

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
  it("declines in an environment with no WebGL, says so once as graph/no-webgl, and says it failed", () => {
    const onFailure = vi.fn();
    const statuses: string[] = [];
    function Status() {
      statuses.push(useGraphState((s) => s.status));
      return null;
    }
    const { corpus } = fakeCorpus();
    render(
      <GraphRoot corpus={corpus} onFailure={onFailure}>
        <GraphCanvas />
        <Status />
      </GraphRoot>,
    );
    expect(statuses.at(-1)).toBe("failed");
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0]?.[0]).toBeInstanceOf(GraphError);
    expect(onFailure.mock.calls[0]?.[0]).toMatchObject({ code: "graph/no-webgl" });
  });

  it("does not rebuild the renderer because a callback changed identity", () => {
    const calls: string[] = [];
    const tree = (tag: string) => (
      <GraphRoot corpus={null} onFailure={(error) => calls.push(`${tag}:${String(error)}`)}>
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
      seen.push(useGraphState((s) => s.total));
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

describe("useGraphState", () => {
  it("keeps the api's identity across hovers, and re-renders a part only on the slice it selects", () => {
    const { corpus } = fakeCorpus();
    const apis = new Set<unknown>();
    let toolRenders = 0;
    let hoverRenders = 0;
    function Host() {
      apis.add(useGraphContext());
      return null;
    }
    function ToolPart() {
      useGraphState((s) => s.tool);
      toolRenders += 1;
      return null;
    }
    function HoverPart() {
      useGraphState((s) => s.hovered);
      hoverRenders += 1;
      return null;
    }
    const held: { store: ReturnType<typeof internalsOf>["store"] | null } = { store: null };
    function Hold() {
      held.store = internalsOf(useGraphContext()).store;
      return null;
    }
    render(
      <GraphRoot corpus={corpus} onFailure={() => {}}>
        <Host />
        <ToolPart />
        <HoverPart />
        <Hold />
      </GraphRoot>,
    );
    const [tools, hovers] = [toolRenders, hoverRenders];
    act(() => held.store?.hover(3));
    act(() => held.store?.hover(4));
    expect(hoverRenders - hovers).toBe(2);
    expect(toolRenders).toBe(tools);
    expect(apis.size).toBe(1);
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
    const options = result.current.getState().options;
    rerender({ tag: "b" });
    rerender({ tag: "c" });
    expect(result.current.getState().options).toBe(options);
  });

  it("hands the store a new binding when a prop moves", async () => {
    const fake = fakeCorpus();
    const { rerender } = renderHook(({ fill }: { fill: string }) => useGraph({ corpus: fake.corpus, fill, onFailure: () => {} }), {
      initialProps: { fill: "cluster_id" },
    });
    await act(() => fake.settle());
    rerender({ fill: "degree" });
    expect(fake.scans.at(-1)?.select).toContain("degree");
  });
});
