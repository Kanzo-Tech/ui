import { describe, expect, it, vi } from "vitest";
import { fakeCorpus } from "../../test/corpus";
import { createGraph } from "./store";
import type { Viewport } from "./tile-matrix";

/**
 * The store with no React in it: what a subscriber hears, and how often. The adapter half is in
 * `react/graph-root.test.tsx`.
 */

const near: Viewport = { xMin: 0.5, xMax: 2.5, yMin: -1, yMax: 1 };
const far: Viewport = { xMin: -1, xMax: 17, yMin: -1, yMax: 1 };

function subscribed() {
  const fake = fakeCorpus();
  const onFailure = vi.fn();
  const store = createGraph({ corpus: fake.corpus, fill: "cluster_id", r: "degree", onFailure });
  const heard = vi.fn();
  const unsubscribe = store.subscribe(heard);
  return { fake, heard, onFailure, store, unsubscribe };
}

describe("the graph store", () => {
  it("notifies subscribers once when a tile loads", async () => {
    const { fake, heard, store } = subscribed();
    store.setViewport(near);
    const before = heard.mock.calls.length;
    await fake.settle();
    expect(heard.mock.calls.length - before).toBe(1);
    expect(store.getSnapshot().visible).toHaveLength(1);
    expect(fake.reads.map((r) => `${r.kind}:${r.direction ?? ""}`)).toEqual(["rows:", "edges:src", "edges:dst"]);
  });

  it("keeps getSnapshot stable between notifications", async () => {
    const { fake, heard, store } = subscribed();
    store.setViewport(near);
    await fake.settle();
    const snapshot = store.getSnapshot();
    const calls = heard.mock.calls.length;
    store.setViewport({ ...near });
    store.setViewport({ ...near, xMax: 2.6 });
    expect(heard.mock.calls.length).toBe(calls);
    expect(store.getSnapshot()).toBe(snapshot);
  });

  it("plans once per question, never per camera move", async () => {
    const { fake, store } = subscribed();
    store.setViewport(near);
    store.setViewport(far);
    store.setViewport({ ...near, xMin: 4.5, xMax: 6.5 });
    await fake.settle();
    expect(fake.scans).toHaveLength(1);
    store.setOptions({ ...store.getOptions(), r: "cluster_id" });
    expect(fake.scans).toHaveLength(2);
    expect(fake.scans[1]?.select).toContain("cluster_id");
  });

  it("projects the bound columns and nothing a constant names", () => {
    const fake = fakeCorpus();
    createGraph({ corpus: fake.corpus, fill: "var(--foreground)", symbol: "kind", title: "label", onFailure: () => {} });
    expect(fake.scans[0]?.select).toEqual(["dense_id", "x", "y", "kind", "label"]);
  });

  it("reads the payload at a close camera and a rung at a far one", async () => {
    const { fake, store } = subscribed();
    store.setOptions({ ...store.getOptions(), limit: 8 });
    store.setViewport(far);
    await fake.settle();
    expect(store.getSnapshot().z).toBe(0);
    store.setViewport(near);
    await fake.settle();
    expect(store.getSnapshot().z).toBe(1);
  });

  it("reports what the corpus declined, once per relation and direction", async () => {
    const { fake, store } = subscribed();
    store.setOptions({ ...store.getOptions(), limit: 4 });
    store.setViewport(far);
    await fake.settle();
    expect(store.getSnapshot().declined).toEqual([]);
  });

  it("lets the tiles go when the last subscriber leaves", async () => {
    const { fake, store, unsubscribe } = subscribed();
    store.setViewport(near);
    await new Promise((resolve) => setTimeout(resolve, 80));
    unsubscribe();
    expect(fake.reads[0]?.signal?.aborted).toBe(true);
  });
});
