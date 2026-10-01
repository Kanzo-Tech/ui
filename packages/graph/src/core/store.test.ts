import { Selection, clauseInterval } from "@kanzo-tech/mosaic";
import type { Corpus } from "@fossil-lang/corpus";
import { describe, expect, it, vi } from "vitest";
import { MANIFEST, fakeCorpus } from "../../test/corpus";
import { graphClient } from "./filter";
import { createGraph } from "./store";

/**
 * The store with no React in it: what it reads, what a subscriber hears, and how often. The adapter
 * half is in `react/graph-root.test.tsx`.
 */

function subscribed() {
  const fake = fakeCorpus();
  const onFailure = vi.fn();
  const store = createGraph({ corpus: fake.corpus, fill: "cluster_id", r: "degree", onFailure });
  const heard = vi.fn();
  const unsubscribe = store.subscribe(heard);
  return { fake, heard, onFailure, store, unsubscribe };
}

const tables = (scans: readonly { table: string }[]) => scans.map((scan) => scan.table);
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
/** What fossil's `scan.read` rejects with: an `Error` carrying a code. */
const refusal = () => Object.assign(new Error("the bucket did not answer"), { code: "storage/unreachable" });

describe("the graph store", () => {
  it("holds a failure found while it is built, and reports it to the first subscriber", () => {
    // `useGraph` builds the store inside `useState`, so a failure found here is found during a
    // render, and a host's `onFailure` is usually a `setState` — React refuses it there.
    const fake = fakeCorpus({ ...MANIFEST, vertex_tables: MANIFEST.vertex_tables.filter((table) => !table.position) });
    const onFailure = vi.fn();
    const store = createGraph({ corpus: fake.corpus, onFailure });

    expect(onFailure).not.toHaveBeenCalled();

    const unsubscribe = store.subscribe(() => {});
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ code: "graph/nothing-to-draw" }));

    unsubscribe();
    store.subscribe(() => {});
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it("loads every vertex type with a position, indexed by its dense_id", async () => {
    const { fake, store } = subscribed();
    await fake.settle();
    const { geometry, encoding } = store.getSnapshot();
    expect(geometry?.tables.map((table) => table.name)).toEqual(["Person", "Place"]);
    expect(geometry?.size).toBe(16);
    expect(Array.from(geometry?.positions.subarray(6, 8) ?? [])).toEqual([3, 0]);
    expect(Array.from(geometry?.positions.subarray(24, 26) ?? [])).toEqual([2, 1]);
    expect(geometry?.table[12]).toBe(1);
    expect(encoding?.sizes?.[3]).toBe(4);
    expect(store.getSnapshot().drawn?.vertices).toBe(16);
  });

  it("loads the relations whose two ends are drawn, and no other", async () => {
    const { fake, store } = subscribed();
    await fake.settle();
    expect(tables(fake.scans)).not.toContain("Person_tagged_Tag");
    expect(tables(fake.scans)).not.toContain("Tag");
    const links = store.getSnapshot().geometry?.links;
    expect(links?.length).toBe(2 * (9 + 10));
    expect(Array.from(links?.subarray(0, 2) ?? [])).toEqual([0, 1]);
  });

  it("notifies subscribers once when the graph loads", async () => {
    const { fake, heard, store } = subscribed();
    const before = heard.mock.calls.length;
    await fake.settle();
    expect(heard.mock.calls.length - before).toBe(1);
    expect(store.getSnapshot().geometry).not.toBeNull();
  });

  it("keeps getSnapshot stable between notifications", async () => {
    const { fake, heard, store } = subscribed();
    await fake.settle();
    const snapshot = store.getSnapshot();
    const calls = heard.mock.calls.length;
    store.hover(null);
    store.setTool(null);
    expect(heard.mock.calls.length).toBe(calls);
    expect(store.getSnapshot()).toBe(snapshot);
  });

  it("reads once per question, never per camera move", async () => {
    const { fake, store } = subscribed();
    await fake.settle();
    expect(tables(fake.scans)).toEqual(["Person", "Place", "Person_knows_Person", "Person_livesIn_Place"]);
    const geometry = store.getSnapshot().geometry;
    store.setOptions({ ...store.getOptions(), r: "cluster_id" });
    await fake.settle();
    expect(tables(fake.scans.slice(4))).toEqual(["Person", "Place"]);
    expect(fake.scans[4]?.select).toEqual(["dense_id", "cluster_id"]);
    expect(store.getSnapshot().geometry).toBe(geometry);
  });

  it("projects the bound columns and nothing a constant names", () => {
    const fake = fakeCorpus();
    createGraph({ corpus: fake.corpus, fill: "var(--foreground)", symbol: "cluster_id", title: "subject", onFailure: () => {} });
    expect(fake.scans[0]?.select).toEqual(["dense_id", "x", "y", "cluster_id"]);
    expect(fake.scans[1]?.select).toEqual(["dense_id", "lon", "lat"]);
  });

  it("a filter masks the survivors and reads no geometry", async () => {
    const fake = fakeCorpus();
    const crossfilter = Selection.crossfilter();
    const store = createGraph({ corpus: fake.corpus, filterBy: crossfilter, onFailure: () => {} });
    store.subscribe(() => {});
    await fake.settle();
    const geometry = store.getSnapshot().geometry;
    const before = fake.scans.length;
    crossfilter.update(clauseInterval("cluster_id", [1, 1], { source: graphClient() }));
    await fake.settle();
    expect(fake.scans.slice(before).map((scan) => [scan.table, scan.select])).toEqual([["Person", ["dense_id"]]]);
    expect(store.getSnapshot().geometry).toBe(geometry);
    const mask = store.getSnapshot().mask;
    expect([...Array(16).keys()].filter((id) => mask?.[id])).toEqual([1, 5, 9, 10, 11, 12, 13, 14, 15]);
    expect(store.getSnapshot().drawn?.vertices).toBe(9);
  });

  it("loads again after StrictMode's unsubscribe, and never reports the cancelled read", async () => {
    const { fake, onFailure, store, unsubscribe } = subscribed();
    unsubscribe();
    store.subscribe(() => {});
    await fake.settle();
    expect(onFailure).not.toHaveBeenCalled();
    expect(store.getSnapshot().status).not.toBe("failed");
    expect(store.getSnapshot().drawn?.vertices).toBeGreaterThan(0);
  });

  it("lets the graph go when the last subscriber leaves", async () => {
    const { fake, unsubscribe } = subscribed();
    await new Promise((resolve) => setTimeout(resolve, 0));
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
    expect(store.getSnapshot().status).toBe("loading");
    expect(store.getSnapshot().total).toBe(16);
    store.setOptions({ ...store.getOptions(), corpus: null });
    expect(store.getSnapshot().status).toBe("none");
  });

  it("fails, and says so once, when the promised corpus does not open", async () => {
    const onFailure = vi.fn();
    const refused = refusal();
    const store = createGraph({ corpus: Promise.reject(refused), onFailure });
    await tick();
    expect(store.getSnapshot().status).toBe("failed");
    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure.mock.calls[0]?.[0]).toBe(refused);
  });

  it("waits on a corpus promise that never settles, with no deadline of its own, and lets it go when replaced", async () => {
    vi.useFakeTimers();
    try {
      const onFailure = vi.fn();
      let late: (corpus: Corpus) => void = () => {};
      const store = createGraph({ corpus: new Promise<Corpus>((resolve) => (late = resolve)), onFailure });
      store.subscribe(() => {});
      await vi.advanceTimersByTimeAsync(10 * 60_000);
      expect(store.getSnapshot().status).toBe("opening");
      expect(onFailure).not.toHaveBeenCalled();

      store.setOptions({ ...store.getOptions(), corpus: null });
      late(fakeCorpus().corpus);
      await vi.advanceTimersByTimeAsync(0);
      expect(store.getSnapshot().status).toBe("none");
      expect(store.getSnapshot().corpus).toBeNull();
      expect(onFailure).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails with the thrown value itself, code and all, when the graph's read rejects after the corpus opened", async () => {
    const { fake, onFailure, store } = subscribed();
    const refused = refusal();
    fake.reads[0]?.reject(refused);
    await tick();
    expect(store.getSnapshot().status).toBe("failed");
    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure.mock.calls[0]?.[0]).toBe(refused);
  });

  it("aborts the sibling reads when one of them rejects", async () => {
    const { fake, onFailure } = subscribed();
    expect(fake.reads.length).toBeGreaterThan(1);
    fake.reads[0]?.reject(refusal());
    await tick();
    expect(fake.reads.slice(1).every((read) => read.signal?.aborted)).toBe(true);
    expect(onFailure).toHaveBeenCalledOnce();
  });

  it("keeps the last picture and reports the thrown value when a filter's read rejects", async () => {
    const fake = fakeCorpus();
    const crossfilter = Selection.crossfilter();
    const onFailure = vi.fn();
    const store = createGraph({ corpus: fake.corpus, filterBy: crossfilter, onFailure });
    store.subscribe(() => {});
    await fake.settle();
    store.reportDrawn(store.getSnapshot());
    const { geometry, encoding } = store.getSnapshot();
    crossfilter.update(clauseInterval("cluster_id", [1, 1], { source: graphClient() }));
    await tick();
    const read = fake.reads.find((r) => !r.released && r.params.filter !== undefined);
    const refused = refusal();
    read?.reject(refused);
    await tick();
    expect(onFailure.mock.calls.map(([error]) => error)).toEqual([refused]);
    expect(onFailure.mock.calls[0]?.[0]).toBe(refused);
    expect(store.getSnapshot()).toMatchObject({ status: "idle", geometry, encoding, mask: null });
  });

  it("is idle only once the graph is loaded and drawn", async () => {
    const { fake, store } = subscribed();
    expect(store.getSnapshot().status).toBe("loading");
    await fake.settle();
    expect(store.getSnapshot().status).toBe("loading");
    store.reportDrawn(store.getSnapshot());
    expect(store.getSnapshot().status).toBe("idle");
    store.setOptions({ ...store.getOptions(), fill: "degree" });
    expect(store.getSnapshot().status).toBe("loading");
  });

  it("fixes the categorical domain before the graph loads", () => {
    const fake = fakeCorpus();
    const store = createGraph({ corpus: fake.corpus, onFailure: () => {} });
    expect(store.getSnapshot().domain).toEqual(["Person", "Place"]);
    store.setOptions({ ...store.getOptions(), fill: "kind", categories: { beast: "Beast", tag: "Tag" } });
    expect(store.getSnapshot().domain).toEqual(["beast", "tag"]);
  });

  it("colours by vertex type unless fill binds a column", async () => {
    const fake = fakeCorpus();
    const store = createGraph({ corpus: fake.corpus, onFailure: () => {} });
    store.subscribe(() => {});
    await fake.settle();
    expect(store.getSnapshot().drawn).toEqual({ vertices: 16, domain: ["Person", "Place"], tally: [10, 6] });
  });
});
