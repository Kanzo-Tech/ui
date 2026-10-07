import { Query, Selection, asTableRef, clauseInterval, clauseMatch, clausePoint, clauseSemiJoin, isIn, literal } from "@kanzo-tech/mosaic";
import { describe, expect, it, vi } from "vitest";
import { attach, refusal, settle, type Attached } from "../../test/corpus";
import { createGraph } from "./store";
import type { GraphOptions } from "./state";

/**
 * The store with no React in it, over a real DuckDB through a real coordinator: what it reads, what a
 * subscriber hears, and how a page's crossfilter reaches it. The adapter half is in
 * `react/graph-root.test.tsx`.
 */

/** A chart beside the graph: the source of the clauses the page publishes. */
const chart = { reset() {} };
const ids = (mask: Uint8Array | null | undefined) => [...(mask ?? [])].flatMap((on, id) => (on ? [id] : []));

async function graph(over: Partial<GraphOptions> = {}, attached?: Attached) {
  const corpus = attached ?? (await attach());
  const onFailure = vi.fn();
  const store = createGraph({ from: corpus.from, coordinator: corpus.coordinator, onFailure, ...over });
  const heard = vi.fn();
  const unsubscribe = store.subscribe(heard);
  return { corpus, heard, onFailure, store, unsubscribe };
}

describe("the graph store", () => {
  it("reads the structure from fossil_tables and fossil_columns, and every vertex by its dense_id", async () => {
    const { corpus, store } = await graph();
    await settle(corpus);
    const { geometry, structure } = store.getSnapshot();
    expect(structure?.vertices.map((t) => [t.name, t.first, t.rows, t.identity])).toEqual([
      ["Person", 0, 10, "subject"],
      ["Place", 10, 6, "subject"],
      ["Tag", 16, 4, "subject"],
    ]);
    expect(structure?.edges.map((e) => [e.name, e.label, e.source, e.destination])).toEqual([
      ["Person_knows_Person", "knows", "Person", "Person"],
      ["Person_livesIn_Place", "livesIn", "Person", "Place"],
      ["Person_tagged_Tag", "tagged", "Person", "Tag"],
    ]);
    expect(structure?.key).toBe("dense_id");
    expect(store.getSnapshot().total).toBe(20);
    expect(geometry?.size).toBe(20);
    expect(geometry?.links.length).toBe(2 * 20);
  });

  it("reads the vertex key from the address role, and refuses a corpus that gives none as graph/nothing-to-draw", async () => {
    const corpus = await attach();
    await corpus.coordinator.exec(
      `ALTER VIEW ${corpus.from}.fossil_columns RENAME TO written;
       CREATE VIEW ${corpus.from}.fossil_columns AS SELECT * REPLACE (NULLIF(role, 'address') AS role) FROM ${corpus.from}.written;`,
    );
    const { onFailure, store } = await graph({}, corpus);
    await settle(corpus);
    expect(onFailure.mock.calls[0]?.[0]).toMatchObject({ name: "GraphError", code: "graph/nothing-to-draw" });
    expect(store.getSnapshot().structure).toBeNull();
  });

  it("starts a layout from a seeded square when x and y are unbound, the same start every time", async () => {
    const first = await graph();
    await settle(first.corpus);
    const second = await graph();
    await settle(second.corpus);
    const a = first.store.getSnapshot().geometry;
    expect(a?.bound).toBe(false);
    expect(a?.extent).toBeNull();
    expect(a?.space).toBe(4096);
    expect([...(a?.positions ?? [])].every((v) => v > 0 && v < 4096)).toBe(true);
    expect(second.store.getSnapshot().geometry?.positions).toEqual(a?.positions);
  });

  it("draws the data's positions when x and y are bound, and leaves a table without them unplaced", async () => {
    const { corpus, store } = await graph({ x: "lon", y: "lat" });
    await settle(corpus);
    const geometry = store.getSnapshot().geometry;
    expect(geometry?.bound).toBe(true);
    expect(Array.from(geometry?.positions.subarray(6, 8) ?? [])).toEqual([3, 0]);
    expect(Array.from(geometry?.positions.subarray(24, 26) ?? [])).toEqual([2, 1]);
    expect(Number.isNaN(geometry?.positions[2 * 17])).toBe(true);
    expect(geometry?.extent).toEqual({ x: 0, y: 0, w: 9, h: 1 });
    // Tag has no position, so it is not counted as drawn.
    expect(store.getSnapshot().drawn?.vertices).toBe(16);
  });

  it("reads a column the corpus does not carry as unbound, so a column chosen on another corpus places nothing", async () => {
    const { corpus, store } = await graph({ x: "lon", y: "elevation", cluster: "nowhere" });
    await settle(corpus);
    expect(store.getSnapshot().geometry?.bound).toBe(false);
    expect(store.getSnapshot().encoding?.clusters).toBeNull();
  });

  it("reads positions again when x or y moves, and nothing else", async () => {
    const { corpus, store } = await graph({ x: "lon", y: "lat" });
    await settle(corpus);
    const before = corpus.sent.length;
    store.setOptions({ ...store.getOptions(), x: undefined, y: undefined });
    await settle(corpus);
    expect(store.getSnapshot().geometry?.bound).toBe(false);
    expect(corpus.sent.slice(before).some((sql) => sql.includes("fossil_tables"))).toBe(false);
  });

  it("sizes by degree when r is unbound, and by the column when it is bound", async () => {
    const { corpus, store } = await graph();
    await settle(corpus);
    // Person 0 knows 1, lives in 10 and is tagged 16; Person 5 is known by 4, knows 6, lives in 15.
    expect(store.getSnapshot().encoding?.sizes[0]).toBe(3);
    expect(store.getSnapshot().encoding?.sizes[5]).toBe(3);
    expect(store.getSnapshot().encoding?.sizes[10]).toBe(2);
    store.setOptions({ ...store.getOptions(), r: "score" });
    await settle(corpus);
    const sizes = store.getSnapshot().encoding?.sizes;
    expect(sizes?.[3]).toBe(4);
    expect(Number.isNaN(sizes?.[12])).toBe(true);
  });

  it("reads the cluster channel as one code per value, and none for a table without the column", async () => {
    const { corpus, store } = await graph({ cluster: "team" });
    await settle(corpus);
    const clusters = store.getSnapshot().encoding?.clusters;
    expect(clusters?.slice(0, 5)).toEqual([0, 1, 2, 3, 0]);
    expect(clusters?.[12]).toBeUndefined();
    store.setOptions({ ...store.getOptions(), cluster: undefined });
    await settle(corpus);
    expect(store.getSnapshot().encoding?.clusters).toBeNull();
  });

  it("colours by vertex type unless fill binds a column", async () => {
    const { corpus, store } = await graph();
    await settle(corpus);
    expect(store.getSnapshot().drawn).toEqual({ vertices: 20, edges: 20, domain: ["Person", "Place", "Tag"], tally: [10, 6, 4], placed: [10, 6, 4] });
    store.setOptions({ ...store.getOptions(), fill: "team" });
    await settle(corpus);
    expect(store.getSnapshot().drawn?.domain).toEqual([0, 1, 2, 3, null]);
  });

  it("fixes the categorical domain before the graph loads", async () => {
    const corpus = await attach();
    const store = createGraph({ from: corpus.from, coordinator: corpus.coordinator, fill: "kind", categories: { beast: "Beast" }, onFailure: () => {} });
    expect(store.getSnapshot().domain).toEqual(["beast"]);
  });

  it("keeps getSnapshot stable between notifications", async () => {
    const { corpus, heard, store } = await graph();
    await settle(corpus);
    const snapshot = store.getSnapshot();
    const calls = heard.mock.calls.length;
    store.hover(null);
    store.setTool(null);
    expect(heard.mock.calls.length).toBe(calls);
    expect(store.getSnapshot()).toBe(snapshot);
  });

  it("is idle only once the graph is loaded and drawn, and has none without a corpus", async () => {
    const { corpus, store } = await graph();
    expect(store.getSnapshot().status).toBe("loading");
    await settle(corpus);
    expect(store.getSnapshot().status).toBe("loading");
    store.reportDrawn(store.getSnapshot());
    expect(store.getSnapshot().status).toBe("idle");
    store.setOptions({ ...store.getOptions(), fill: "team" });
    expect(store.getSnapshot().status).toBe("loading");
    store.setOptions({ ...store.getOptions(), from: null });
    expect(store.getSnapshot()).toMatchObject({ status: "none", structure: null, geometry: null });
  });

  it("fails with the thrown value itself, code and all, when a read rejects", async () => {
    const corpus = await attach();
    const refused = refusal();
    corpus.refuse(/fossil_tables/, refused);
    const { onFailure, store } = await graph({}, corpus);
    await settle(corpus);
    expect(store.getSnapshot().status).toBe("failed");
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(refused);
  });

  it("fails, and says so once, when the catalog it names is not attached", async () => {
    const corpus = await attach();
    const { onFailure, store } = await graph({ from: "nowhere" }, corpus);
    await settle(corpus);
    expect(store.getSnapshot().status).toBe("failed");
    expect(onFailure).toHaveBeenCalledOnce();
    expect(String(onFailure.mock.calls[0]?.[0])).toMatch(/nowhere/);
  });

  it("drops a stale answer when the corpus changes under it", async () => {
    const first = await attach();
    const second = await attach();
    const { onFailure, store } = await graph({}, first);
    store.setOptions({ ...store.getOptions(), from: second.from, coordinator: second.coordinator });
    await settle(first);
    await settle(second);
    expect(store.getSnapshot().structure?.from).toBe(second.from);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("remembers what the search went to, newest first, once each and five at most, until the corpus changes", async () => {
    const { corpus, store } = await graph();
    await settle(corpus);
    for (const vertex of [1, 2, 3, 4, 5, 6, 2]) store.remember(vertex, `#${vertex}`);
    expect(store.getSnapshot().recent.map((r) => r.vertex)).toEqual([2, 6, 5, 4, 3]);
    const next = await attach();
    store.setOptions({ ...store.getOptions(), from: next.from, coordinator: next.coordinator });
    expect(store.getSnapshot().recent).toEqual([]);
  });

  it("connects its client on the first subscriber and lets it go with the last, as StrictMode does twice", async () => {
    const { corpus, onFailure, store, unsubscribe } = await graph();
    unsubscribe();
    expect(corpus.coordinator.clients.size).toBe(0);
    store.subscribe(() => {});
    expect(corpus.coordinator.clients.size).toBe(1);
    await settle(corpus);
    expect(onFailure).not.toHaveBeenCalled();
    expect(store.getSnapshot().drawn?.vertices).toBe(20);
  });
});

describe("the page's crossfilter", () => {
  async function filtered() {
    const crossfilter = Selection.crossfilter();
    const view = await graph({ filterBy: crossfilter });
    await settle(view.corpus);
    return { crossfilter, ...view };
  }

  it("asks the coordinator which vertices survive, and keeps every buffer it has", async () => {
    const { corpus, crossfilter, store } = await filtered();
    const { geometry, encoding } = store.getSnapshot();
    crossfilter.update(clauseInterval("score", [2, 5], { source: chart }));
    await settle(corpus);
    // Person 1–4 by score; Place and Tag have no `score`, so the clause does not reach them.
    expect(ids(store.getSnapshot().mask)).toEqual([1, 2, 3, 4, ...Array.from({ length: 10 }, (_, i) => 10 + i)]);
    expect(store.getSnapshot()).toMatchObject({ geometry, encoding });
    expect(store.getSnapshot().drawn?.vertices).toBe(14);
    expect(store.getSnapshot().matching).toBe(14);
    crossfilter.update(clauseInterval("score", null, { source: chart }));
    await settle(corpus);
    expect(store.getSnapshot().mask).toBeNull();
    expect(store.getSnapshot().matching).toBeNull();
  });

  it("runs the predicate as Mosaic wrote it, on every table that has its columns", async () => {
    const { corpus, crossfilter, store } = await filtered();
    crossfilter.update(clausePoint("name", "Place 3", { source: chart }));
    await settle(corpus);
    // Only Tag lacks `name`, so it stays in full colour beside the one Place that matched.
    expect(ids(store.getSnapshot().mask)).toEqual([13, 16, 17, 18, 19]);
  });

  it("refuses a clause no vertex type can answer, as graph/unfilterable, and draws the graph unfiltered", async () => {
    const { corpus, crossfilter, onFailure, store } = await filtered();
    crossfilter.update(clauseMatch("colour", "grey", { source: chart, method: "contains" }));
    await settle(corpus);
    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure.mock.calls[0]?.[0]).toMatchObject({ name: "GraphError", code: "graph/unfilterable" });
    expect(store.getSnapshot().mask).toBeNull();
  });

  it("answers a semi-join on dense_id on every table, whatever relation its subquery reads", async () => {
    const { corpus, crossfilter, onFailure, store } = await filtered();
    // Who lives in a place: rows of an edge table, whose `src` and `dst` no vertex table has.
    const residents = Query.select("src").from(asTableRef([corpus.from, "Person_livesIn_Place"])!).where(isIn("src", [literal(1), literal(2)]));
    crossfilter.update(clauseSemiJoin("dense_id", residents, { source: chart, label: "Residents" }));
    await settle(corpus);
    expect(onFailure).not.toHaveBeenCalled();
    // An identity clause keeps its members in every table, and nothing else in any of them.
    expect(ids(store.getSnapshot().mask)).toEqual([1, 2]);
  });

  it("publishes the reader's pick as a semi-join on dense_id, and is exempt from its own clause", async () => {
    const { corpus, crossfilter, store } = await filtered();
    const before = corpus.sent.length;
    store.select([3, 4], "marquee", "Marquee");
    await settle(corpus);
    expect(String(crossfilter.predicate(chart as never))).toBe(`("dense_id" IN (3, 4))`);
    expect(crossfilter.clauses[0]?.meta).toEqual({ type: "semijoin", label: "Marquee" });
    expect(store.getSnapshot().mask).toBeNull();
    expect(corpus.sent.slice(before).filter((sql) => sql.includes("WHERE"))).toEqual([]);
    store.select(null);
    expect(String(crossfilter.predicate(chart as never) ?? "")).not.toContain("dense_id");
  });

  it("lets the pick go when its clause is retracted where it was published", async () => {
    const onSelect = vi.fn();
    const crossfilter = Selection.crossfilter();
    const { corpus, store } = await graph({ filterBy: crossfilter, onSelect });
    await settle(corpus);
    store.select([3, 4], "lasso", "Lasso");
    crossfilter.reset([...crossfilter.clauses]);
    expect(store.getSnapshot().selection).toBeNull();
    expect(onSelect).toHaveBeenLastCalledWith(null);
    await settle(corpus);
    expect(crossfilter.clauses.map((c) => c.meta)).toEqual([]);
  });

  it("withdraws its pick from the crossfilter it leaves, and publishes it on the one it joins", async () => {
    const first = Selection.crossfilter();
    const second = Selection.crossfilter();
    const { corpus, store } = await graph({ filterBy: first });
    await settle(corpus);
    store.select([3, 4], "lasso", "Lasso");
    store.setOptions({ ...store.getSnapshot().options, filterBy: second });
    await settle(corpus);
    expect(first.clauses.map((c) => c.meta)).toEqual([]);
    expect(second.clauses.map((c) => c.meta)).toEqual([{ type: "semijoin", label: "Lasso" }]);
  });

  it("keeps the last picture and reports the thrown value when a filter's read rejects", async () => {
    const { corpus, crossfilter, onFailure, store } = await filtered();
    const { geometry, encoding } = store.getSnapshot();
    const refused = refusal();
    corpus.refuse(/score/, refused);
    crossfilter.update(clauseInterval("score", [2, 5], { source: chart }));
    await settle(corpus);
    expect(onFailure.mock.calls.map(([error]) => error)).toEqual([refused]);
    expect(store.getSnapshot()).toMatchObject({ geometry, encoding, mask: null });
    expect(store.getSnapshot().status).not.toBe("failed");
  });
});
