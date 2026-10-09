import { Selection, clauseInterval } from "@kanzo-tech/mosaic";
import { act, renderHook } from "@testing-library/react";
import type React from "react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { Graph } from "@cosmos.gl/graph";
import { attach, settle } from "../../test/corpus";
import { createGraph } from "../core/store";
import type { Tool, VertexId } from "../core/types";
import { useGesture } from "./gesture";

/**
 * The gesture against a real store and a page's crossfilter, with a cosmos.gl whose hit test catches
 * what the test says. What this cannot prove is that the lasso drawn catches those points — cosmos.gl
 * answers that, on a GPU.
 */

/** Persons `1 … 4` score 2–5, and the other tables have no score: the search keeps those 14 of 20. */
const KEPT = [1, 2, 3, 4, ...Array.from({ length: 10 }, (_, i) => 10 + i)];
const sorted = (ids: readonly VertexId[] | undefined) => [...(ids ?? [])].sort((a, b) => a - b);

async function searched() {
  const corpus = await attach();
  const crossfilter = Selection.crossfilter();
  const store = createGraph({ from: corpus.from, coordinator: corpus.coordinator, filterBy: crossfilter, onFailure: () => {} });
  store.subscribe(() => {});
  await settle(corpus);
  const search = { reset() {} };
  crossfilter.update(clauseInterval("score", [2, 5], { source: search }));
  await settle(corpus);
  const caught: { ids: number[] } = { ids: [] };
  const graph = { findPointsInPolygon: () => caught.ids, findPointsInRect: () => caught.ids } as unknown as Graph;
  const { result } = renderHook(() => {
    const [tool, setTool] = useState<Tool>("lasso");
    return useGesture({
      getGraph: () => graph,
      getSelection: () => store.getSnapshot().selection,
      getVisible: () => store.visible(),
      commit: (vertices, source, label) => store.select(vertices ? [...vertices] : null, source, label),
      setTool,
      tool,
    });
  });
  const pointer = (x: number, keys: Partial<React.PointerEvent> = {}) =>
    ({
      button: 0,
      pointerId: 1,
      clientX: x,
      clientY: x % 20,
      currentTarget: { setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0 }) },
      ...keys,
    }) as unknown as React.PointerEvent;
  /** A lasso of three corners around `ids`, released with `keys` held. */
  const lasso = (ids: number[], keys: Partial<React.PointerEvent> = {}) => {
    caught.ids = ids;
    act(() => result.current.handlers.onPointerDown(pointer(0)));
    act(() => result.current.handlers.onPointerMove(pointer(30)));
    act(() => result.current.handlers.onPointerMove(pointer(60)));
    act(() => result.current.handlers.onPointerUp(pointer(60, keys)));
  };
  const escape = () => act(() => void window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
  const searchHolds = () => crossfilter.clauses.some((clause) => clause.source === search);
  return { corpus, escape, lasso, result, searchHolds, store, pointer };
}

describe("a modified gesture over a filtered page", () => {
  it("starts ⌘ and Alt from what is in full colour when the canvas has no clause", async () => {
    const { lasso, searchHolds, store } = await searched();
    // Person 5 scores 6: added to the canvas's clause, and still greyed out by the search.
    lasso([4, 5], { metaKey: true });
    expect(sorted(store.getSnapshot().selection?.vertices)).toEqual(sorted([...KEPT, 5]));
    expect(sorted(store.visible() ?? [])).toEqual(KEPT);

    store.select(null);
    lasso([1, 10], { altKey: true });
    expect(sorted(store.getSnapshot().selection?.vertices)).toEqual(KEPT.filter((id) => id !== 1 && id !== 10));
    expect(searchHolds()).toBe(true);
  });

  it("adds to and takes from the canvas's own clause when it holds one, and replaces it with no key", async () => {
    const { lasso, store } = await searched();
    store.select([1, 2], "lasso", "Lasso");
    lasso([3], { ctrlKey: true });
    expect(sorted(store.getSnapshot().selection?.vertices)).toEqual([1, 2, 3]);
    lasso([2], { altKey: true });
    expect(sorted(store.getSnapshot().selection?.vertices)).toEqual([1, 3]);
    lasso([4]);
    expect(store.getSnapshot().selection?.vertices).toEqual([4]);
  });

  it("escapes a drag, then the tool, then the canvas's clause, and never retracts another source's clause", async () => {
    const { corpus, escape, pointer, result, searchHolds, store } = await searched();
    store.select([1, 2], "lasso", "Lasso");
    act(() => result.current.handlers.onPointerDown(pointer(0)));
    expect(result.current.drag).not.toBeNull();

    escape();
    expect(result.current.drag).toBeNull();
    expect(result.current.active).toBe("lasso");
    escape();
    expect(result.current.active).toBeNull();
    expect(store.getSnapshot().selection).not.toBeNull();
    escape();
    expect(store.getSnapshot().selection).toBeNull();
    escape();
    await settle(corpus);
    expect(searchHolds()).toBe(true);
    expect(store.getSnapshot().matching).toBe(KEPT.length);
  });
});
