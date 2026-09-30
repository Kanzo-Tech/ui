import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AsyncCollection, useAsyncCollection } from "./use-async-collection.js";

type Item = { label: string; value: string };

/** A source whose requests the test settles by hand, so the order they land in is the test's. */
function source() {
  const requests: { query: string; signal: AbortSignal | undefined; settle: (items: Item[]) => void }[] = [];
  const load = (query: string, signal: AbortSignal | undefined) =>
    new Promise<Item[]>((resolve) => {
      requests.push({ query, signal, settle: resolve });
    });
  /** The `i`th request, which the test knows exists because it counted them. */
  const at = (i: number) => requests[i] as (typeof requests)[number];
  return { load, requests, at };
}

function mount(load: (q: string, s: AbortSignal | undefined) => Promise<Item[]>, debounce?: number) {
  const box: { api?: AsyncCollection<Item> } = {};
  function Probe() {
    box.api = useAsyncCollection<Item>({ load, debounce });
    return null;
  }
  render(<Probe />);
  return {
    get api() {
      return box.api!;
    },
  };
}

const flush = () => act(async () => { await Promise.resolve(); });

describe("useAsyncCollection", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("asks for an empty query on mount and reports loading, then the items", async () => {
    const s = source();
    const t = mount(s.load);
    await flush();

    expect(s.requests.map((r) => r.query)).toEqual([""]);
    expect(t.api.loading).toBe(true);
    expect(t.api.empty).toBe(false);

    await act(async () => s.at(0).settle([{ label: "Alpha", value: "a" }]));
    expect(t.api.loading).toBe(false);
    expect(t.api.collection.items).toEqual([{ label: "Alpha", value: "a" }]);
  });

  it("waits for typing to pause, then asks once, for the last query", async () => {
    const s = source();
    const t = mount(s.load, 200);
    await flush();
    await act(async () => s.at(0).settle([]));

    act(() => t.api.setQuery("a"));
    act(() => vi.advanceTimersByTime(100));
    act(() => t.api.setQuery("al"));
    act(() => vi.advanceTimersByTime(199));
    expect(s.requests).toHaveLength(1);

    act(() => vi.advanceTimersByTime(1));
    await flush();
    expect(s.requests.map((r) => r.query)).toEqual(["", "al"]);
  });

  it("aborts the request a newer query replaces, and ignores its late reply", async () => {
    const s = source();
    const t = mount(s.load, 0);
    await flush();
    await act(async () => s.at(0).settle([]));

    act(() => t.api.setQuery("a"));
    act(() => vi.advanceTimersByTime(0));
    await flush();
    act(() => t.api.setQuery("ab"));
    act(() => vi.advanceTimersByTime(0));
    await flush();

    expect(s.at(1).signal?.aborted).toBe(true);
    await act(async () => s.at(2).settle([{ label: "AB", value: "ab" }]));
    await act(async () => s.at(1).settle([{ label: "A", value: "a" }]));

    expect(t.api.collection.items).toEqual([{ label: "AB", value: "ab" }]);
  });

  it("is empty once a request landed with nothing, and never while one is in flight", async () => {
    const s = source();
    const t = mount(s.load);
    await flush();
    expect(t.api.empty).toBe(false);

    await act(async () => s.at(0).settle([]));
    expect(t.api.empty).toBe(true);
  });

  it("remembers the label of a value after the batch that offered it is gone", async () => {
    const s = source();
    const t = mount(s.load, 0);
    await flush();
    await act(async () => s.at(0).settle([{ label: "Alpha", value: "a" }]));

    act(() => t.api.setQuery("b"));
    act(() => vi.advanceTimersByTime(0));
    await flush();
    await act(async () => s.at(1).settle([{ label: "Beta", value: "b" }]));

    expect(t.api.collection.items.map((i) => i.value)).toEqual(["b"]);
    expect(t.api.labelOf("a")).toBe("Alpha");
    expect(t.api.labelOf("nobody")).toBeUndefined();
  });

  it("keeps the previous items and reports the error when a request fails", async () => {
    let fail = false;
    const t = mount(async () => {
      if (fail) throw new Error("offline");
      return [{ label: "Alpha", value: "a" }];
    }, 0);
    await flush();
    await flush();
    expect(t.api.collection.items).toHaveLength(1);

    fail = true;
    act(() => t.api.setQuery("x"));
    act(() => vi.advanceTimersByTime(0));
    await flush();
    await flush();

    expect(t.api.error).toBeInstanceOf(Error);
    expect(t.api.collection.items).toHaveLength(1);
  });
});
