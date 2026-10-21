import { Query, Selection, clauseInterval, clauseMatch, clausePoint, clauseSemiJoin, holdFirstDraw, isIn, literal, verbatim } from "@kanzo-tech/mosaic";
import { describe, expect, it, vi } from "vitest";
import type { Graph } from "@kanzo-tech/graphar-duckdb";
import { attach, refusal, settle, type Attached } from "../../test/corpus";
import { identityOf, placed } from "./source";
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

/** `graph` with `type` counted as `count`: what a store sizes the canvas by, before it reads anything. */
const counted = (graph: Graph, type: string, count: number): Graph => ({
  ...graph,
  vertexTypes: graph.vertexTypes.map((t) => (t.type === type ? { ...t, count } : t)),
});

async function graph(over: Partial<GraphOptions> = {}, attached?: Attached) {
  const corpus = attached ?? (await attach());
  const onFailure = vi.fn();
  const store = createGraph({ graph: corpus.graph, engine: corpus.engine, onFailure, ...over });
  const heard = vi.fn();
  const unsubscribe = store.subscribe(heard);
  return { corpus, heard, onFailure, store, unsubscribe };
}

describe("the graph store", () => {
  it("reads the structure from the Graph, and every vertex by its global id", async () => {
    const { corpus, store } = await graph();
    await settle(corpus);
    const { geometry, structure } = store.getSnapshot();
    expect(placed(structure!).map(({ type, first }) => [type.type, first, type.count, identityOf(type)])).toEqual([
      ["Person", 0, 10, "subject"],
      ["Place", 10, 6, "subject"],
      ["Tag", 16, 4, "subject"],
    ]);
    expect(structure?.edgeTypes.map((e) => [e.name, e.edgeType, e.srcType, e.dstType])).toEqual([
      ["Person_knows_Person", "knows", "Person", "Person"],
      ["Person_livesIn_Place", "livesIn", "Person", "Place"],
      ["Person_tagged_Tag", "tagged", "Person", "Tag"],
    ]);
    expect(store.getSnapshot().total).toBe(20);
    expect(geometry?.size).toBe(20);
    expect(geometry?.links.length).toBe(2 * 20);
  });

  it("refuses a graph with no vertex as graph/nothing-to-draw", async () => {
    const corpus = await attach();
    const { onFailure, store } = await graph({ graph: { ...corpus.graph, vertexTypes: [] } }, corpus);
    await settle(corpus);
    expect(onFailure.mock.calls[0]?.[0]).toMatchObject({ name: "Problem", code: "graph/nothing-to-draw" });
    expect(store.getSnapshot().structure).toBeNull();
  });

  it("refuses more than 2^24 vertices as graph/too-large, from the Graph's counts and before one link is read", async () => {
    const corpus = await attach();
    const { onFailure, store } = await graph({ graph: counted(corpus.graph, "Person", 16777207) }, corpus);
    await settle(corpus);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0]?.[0]).toMatchObject({ name: "Problem", code: "graph/too-large", data: { count: 2 ** 24 + 1, limit: 2 ** 24 } });
    expect(store.getSnapshot().status).toBe("failed");
    expect(store.getSnapshot().geometry).toBeNull();
    expect(corpus.sent.some((sql) => sql.includes("Person_knows_Person"))).toBe(false);
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
    // Tag has no position, so it is not counted as drawn, but it is counted: its four are the corpus's.
    expect(store.getSnapshot().drawn).toMatchObject({ vertices: 16, edges: 19, tally: [10, 6, 0], placed: [10, 6, 0], totals: [10, 6, 4], links: 20, placedLinks: 19 });
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
    const links = vi.spyOn(corpus.graph, "links");
    store.setOptions({ ...store.getOptions(), x: undefined, y: undefined });
    await settle(corpus);
    expect(store.getSnapshot().geometry?.bound).toBe(false);
    expect(links).not.toHaveBeenCalled();
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
    expect(store.getSnapshot().drawn).toEqual({ vertices: 20, edges: 20, domain: ["Person", "Place", "Tag"], tally: [10, 6, 4], placed: [10, 6, 4], totals: [10, 6, 4], links: 20, placedLinks: 20 });
    store.setOptions({ ...store.getOptions(), fill: "team" });
    await settle(corpus);
    expect(store.getSnapshot().drawn?.domain).toEqual([0, 1, 2, 3, null]);
  });

  it("fixes the categorical domain before the graph loads", async () => {
    const corpus = await attach();
    const store = createGraph({ graph: corpus.graph, engine: corpus.engine, fill: "kind", categories: { beast: "Beast" }, onFailure: () => {} });
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

  it("stays loading while a chart on its page has not drawn its first answer, and is idle once every one has", async () => {
    const page = Selection.crossfilter();
    const { corpus, store } = await graph({ filterBy: page });
    const release = holdFirstDraw(page);
    await settle(corpus);
    store.reportDrawn(store.getSnapshot());
    expect(store.getSnapshot().status).toBe("loading");
    release();
    expect(store.getSnapshot().status).toBe("idle");
    release();
    expect(store.getSnapshot().status).toBe("idle");
    // Shown once, a chart that comes later waits on its own.
    holdFirstDraw(page);
    store.setOptions({ ...store.getOptions(), fill: "team" });
    await settle(corpus);
    store.reportDrawn(store.getSnapshot());
    expect(store.getSnapshot().status).toBe("idle");
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
    store.setOptions({ ...store.getOptions(), graph: null });
    expect(store.getSnapshot()).toMatchObject({ status: "none", structure: null, geometry: null });
  });

  it("fails with the thrown value itself, code and all, when a read rejects", async () => {
    const corpus = await attach();
    const refused = refusal();
    corpus.refuse(/Person_knows_Person/, refused);
    const { onFailure, store } = await graph({}, corpus);
    await settle(corpus);
    expect(store.getSnapshot().status).toBe("failed");
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(refused);
  });

  it("drops a stale answer when the corpus changes under it", async () => {
    const first = await attach();
    const second = await attach();
    const { onFailure, store } = await graph({}, first);
    store.setOptions({ ...store.getOptions(), graph: second.graph, engine: second.engine });
    await settle(first);
    await settle(second);
    expect(store.getSnapshot().structure).toBe(second.graph);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it("stops every read of a load on the engine when the corpus changes, and the root goes, and says nothing", async () => {
    const first = await attach();
    const second = await attach();
    const query = vi.spyOn(first.engine, "query");
    const signals = () => query.mock.calls.map(([, options]) => options.signal);
    const { onFailure, store, unsubscribe } = await graph({}, first);
    // The edges' reads, each asked with the load's signal, which the engine interrupts on.
    expect(signals().length).toBeGreaterThan(0);
    expect(signals().some((signal) => signal.aborted)).toBe(false);
    store.setOptions({ ...store.getOptions(), graph: second.graph, engine: second.engine });
    expect(signals().every((signal) => signal.aborted)).toBe(true);
    query.mockClear();
    store.setOptions({ ...store.getOptions(), graph: first.graph, engine: first.engine });
    unsubscribe();
    expect(signals().length).toBeGreaterThan(0);
    expect(signals().every((signal) => signal.aborted)).toBe(true);
    await settle(first);
    await settle(second);
    expect(onFailure).not.toHaveBeenCalled();
    expect(store.getSnapshot().geometry).toBeNull();
  });

  it("starts the reads again for the subscriber that follows a root that went, as StrictMode does", async () => {
    const { corpus, store, unsubscribe } = await graph();
    unsubscribe();
    store.subscribe(() => {});
    await settle(corpus);
    expect(store.getSnapshot().drawn?.vertices).toBe(20);
  });

  it("retries a failed read from the stage that failed", async () => {
    const corpus = await attach();
    corpus.refuse(/Person_knows_Person/, refusal());
    const { onFailure, store } = await graph({}, corpus);
    await settle(corpus);
    expect(store.getSnapshot()).toMatchObject({ status: "failed", geometry: null });
    store.retry();
    expect(store.getSnapshot().status).toBe("loading");
    await settle(corpus);
    expect(store.getSnapshot().drawn?.vertices).toBe(20);
    expect(onFailure).toHaveBeenCalledOnce();
  });

  it("does nothing on retry unless a read failed", async () => {
    const { corpus, store } = await graph();
    await settle(corpus);
    const before = corpus.sent.length;
    store.retry();
    await settle(corpus);
    expect(corpus.sent).toHaveLength(before);
    expect(store.getSnapshot().status).not.toBe("failed");
  });

  it("fails a graph too large again with the same code on retry", async () => {
    const corpus = await attach();
    const { onFailure, store } = await graph({ graph: counted(corpus.graph, "Person", 16777207) }, corpus);
    await settle(corpus);
    store.retry();
    await settle(corpus);
    expect(onFailure).toHaveBeenCalledTimes(2);
    expect(onFailure.mock.calls[1]?.[0]).toMatchObject({ code: "graph/too-large" });
    expect(store.getSnapshot().status).toBe("failed");
  });

  it("remembers what the search went to, newest first, once each and five at most, until the corpus changes", async () => {
    const { corpus, store } = await graph();
    await settle(corpus);
    for (const vertex of [1, 2, 3, 4, 5, 6, 2]) store.remember(vertex, `#${vertex}`);
    expect(store.getSnapshot().recent.map((r) => r.vertex)).toEqual([2, 6, 5, 4, 3]);
    const next = await attach();
    store.setOptions({ ...store.getOptions(), graph: next.graph, engine: next.engine });
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
    // Person 1–4 by score; Place and Tag have no `score`, so the clause keeps none of them.
    expect(ids(store.getSnapshot().kept)).toEqual([1, 2, 3, 4]);
    expect(store.getSnapshot()).toMatchObject({ geometry, encoding });
    expect(store.getSnapshot().drawn?.vertices).toBe(4);
    expect(store.getSnapshot().matching).toBe(4);
    crossfilter.update(clauseInterval("score", null, { source: chart }));
    await settle(corpus);
    expect(store.getSnapshot().kept).toBeNull();
    expect(store.getSnapshot().matching).toBeNull();
  });

  it("runs the predicate as Mosaic wrote it on every table that has its columns, and keeps none of one that has not", async () => {
    const { corpus, crossfilter, store } = await filtered();
    crossfilter.update(clausePoint("name", "Place 3", { source: chart }));
    await settle(corpus);
    // Tag lacks `name`, so the clause keeps none of it: only the one Place that matched is kept.
    expect(ids(store.getSnapshot().kept)).toEqual([13]);
  });

  it("goes to failed when the survivors cannot be read, keeps its picture, and asks again on retry", async () => {
    const { corpus, crossfilter, onFailure, store } = await filtered();
    const { geometry } = store.getSnapshot();
    const refused = refusal();
    corpus.refuse(/"score"/, refused);
    crossfilter.update(clauseInterval("score", [2, 5], { source: chart }));
    await settle(corpus);
    expect(onFailure).toHaveBeenCalledExactlyOnceWith(refused);
    expect(store.getSnapshot()).toMatchObject({ status: "failed", geometry });
    store.retry();
    await settle(corpus);
    expect(store.getSnapshot().status).not.toBe("failed");
    expect(ids(store.getSnapshot().kept)).toEqual([1, 2, 3, 4]);
  });

  it("keeps nothing under a clause no vertex type can answer, and fails nothing", async () => {
    const { corpus, crossfilter, onFailure, store } = await filtered();
    crossfilter.update(clauseMatch("colour", "grey", { source: chart, method: "contains" }));
    await settle(corpus);
    // No table has `colour`: the clause keeps none of any type, which is not the unfiltered picture.
    expect(onFailure).not.toHaveBeenCalled();
    expect(ids(store.getSnapshot().kept)).toEqual([]);
    expect(store.getSnapshot().matching).toBe(0);
  });

  it("answers a semi-join on dense_id on every table, whatever relation its subquery reads", async () => {
    const { corpus, crossfilter, onFailure, store } = await filtered();
    // Who lives in a place: rows of an edge type, whose `src` and `dst` no vertex type has.
    const lives = store.getSnapshot().structure!.edgeTypes.find((e) => e.name === "Person_livesIn_Place")!;
    const residents = Query.select(lives.src).from(verbatim(lives.table)).where(isIn(lives.src, [literal(1), literal(2)]));
    crossfilter.update(clauseSemiJoin("dense_id", residents, { source: chart, label: "Residents" }));
    await settle(corpus);
    expect(onFailure).not.toHaveBeenCalled();
    // An identity clause keeps its members in every table, and nothing else in any of them.
    expect(ids(store.getSnapshot().kept)).toEqual([1, 2]);
  });

  it("publishes the reader's pick as a semi-join on dense_id, and is exempt from its own clause", async () => {
    const { corpus, crossfilter, store } = await filtered();
    const before = corpus.sent.length;
    store.select([3, 4], "marquee", "Marquee");
    await settle(corpus);
    expect(String(crossfilter.predicate(chart as never))).toBe(`("dense_id" IN (3, 4))`);
    expect(crossfilter.clauses[0]?.meta).toMatchObject({ type: "semijoin", label: "Marquee", relation: { key: "vertices" } });
    // Kept with no query: the canvas's own clause narrows what the page's answer keeps, here everything.
    expect(ids(store.getSnapshot().kept)).toEqual([3, 4]);
    expect(corpus.sent.slice(before).filter((sql) => sql.includes("WHERE"))).toEqual([]);
    store.select(null);
    expect(String(crossfilter.predicate(chart as never) ?? "")).not.toContain("dense_id");
  });

  it("counts what is in full colour: the page's filter narrowed to its own pick, which it is exempt from", async () => {
    const { corpus, crossfilter, store } = await filtered();
    crossfilter.update(clauseInterval("score", [2, 5], { source: chart }));
    await settle(corpus);
    expect(store.getSnapshot().matching).toBe(4);
    // A lasso over Person 3, 4 and 5: 5 is outside the filter, so two of the three are in full colour.
    store.select([3, 4, 5], "lasso", "Lasso");
    await settle(corpus);
    expect(ids(store.getSnapshot().kept)).toEqual([3, 4]);
    expect(store.visible()).toEqual([3, 4]);
    expect(store.getSnapshot().matching).toBe(2);
    expect(store.getSnapshot().drawn).toMatchObject({ vertices: 2, tally: [2, 0, 0] });
    store.select(null);
    await settle(corpus);
    expect(store.getSnapshot().matching).toBe(4);
    expect(store.getSnapshot().drawn?.vertices).toBe(4);
  });

  it("counts a pick alone when nothing else filters the page", async () => {
    const { corpus, store } = await filtered();
    store.select([3, 4], "marquee", "Marquee");
    await settle(corpus);
    expect(ids(store.getSnapshot().kept)).toEqual([3, 4]);
    expect(store.getSnapshot().matching).toBe(2);
    store.select(null);
    expect(store.getSnapshot().matching).toBeNull();
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
    expect(second.clauses.map((c) => c.meta)).toMatchObject([{ type: "semijoin", label: "Lasso", relation: { key: "vertices" } }]);
  });
});
