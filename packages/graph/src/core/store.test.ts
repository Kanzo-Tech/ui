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
  it("holds a failure found while it is built, and reports it to the first subscriber", () => {
    // `useGraph` builds the store inside `useState`, so a failure found here is found during a
    // render, and a host's `onFailure` is usually a `setState` — React refuses it there.
    const fake = fakeCorpus();
    const onFailure = vi.fn();
    const corpus = {
      ...fake.corpus,
      tileMatrix: () => {
        throw new Error("no such type");
      },
    };
    const store = createGraph({ corpus, onFailure });

    expect(onFailure).not.toHaveBeenCalled();

    const unsubscribe = store.subscribe(() => {});
    expect(onFailure).toHaveBeenCalledExactlyOnceWith("no such type");

    unsubscribe();
    store.subscribe(() => {});
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

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

  it("says it is opening while a promised corpus opens, and has none without one", async () => {
    const fake = fakeCorpus();
    let resolve: (corpus: typeof fake.corpus) => void = () => {};
    const promised = new Promise<typeof fake.corpus>((r) => (resolve = r));
    const store = createGraph({ corpus: promised, onFailure: () => {} });
    expect(store.getSnapshot().status).toBe("opening");
    resolve(fake.corpus);
    await promised;
    await Promise.resolve();
    expect(store.getSnapshot().status).toBe("reading");
    expect(store.getSnapshot().total).toBe(16);
    store.setOptions({ ...store.getOptions(), corpus: null });
    expect(store.getSnapshot().status).toBe("none");
  });

  it("fails, and says so once, when the promised corpus does not open", async () => {
    const onFailure = vi.fn();
    const store = createGraph({ corpus: Promise.reject(new Error("no manifest")), onFailure });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.getSnapshot().status).toBe("failed");
    expect(onFailure).toHaveBeenCalledExactlyOnceWith("no manifest");
  });

  it("is idle only once everything in view is drawn", async () => {
    const { fake, store } = subscribed();
    store.setViewport(near);
    await fake.settle();
    const { visible } = store.getSnapshot();
    expect(store.getSnapshot().status).toBe("reading");
    store.reportDrawn(visible, { marks: 4, represented: 4, domain: [], tally: [] });
    expect(store.getSnapshot().status).toBe("idle");
    store.setViewport(far);
    expect(store.getSnapshot().status).toBe("reading");
  });

  it("fixes the categorical domain from the manifest before a tile arrives", () => {
    const { store } = subscribed();
    expect(store.getSnapshot().domain).toEqual([0, 1, 2, 3]);
    store.setOptions({ ...store.getOptions(), fill: "kind", categories: { beast: "Beast", tag: "Tag" } });
    expect(store.getSnapshot().domain).toEqual(["beast", "tag"]);
  });
});
