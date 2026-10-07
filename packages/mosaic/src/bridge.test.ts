import { MosaicClient, Selection, clauseInterval, clausePoint, type SelectionClause } from "@uwdata/mosaic-core";
import { describe, expect, it, vi } from "vitest";
import { bridgeSelection, bridged, type BridgeOptions } from "./bridge.js";
import { clauseSemiJoin, semiJoinOf } from "./clause.js";

/** Two tiles crossfiltering inside a dashboard, and a graph beside it on the page. */
function page() {
  const outer = Selection.crossfilter();
  const inner = Selection.crossfilter();
  const tiles = [new MosaicClient(inner), new MosaicClient(inner)] as const;
  const graph = new MosaicClient(outer);
  const brush = (tile: MosaicClient, range: [number, number] | null, reset = () => {}) =>
    clauseInterval("Person.score", range, { source: Object.assign(tile, { reset }), clients: new Set([tile]) });
  const options = (more: BridgeOptions = {}): BridgeOptions => more;
  return { outer, inner, tiles, graph, brush, options };
}

/** Until every value event queued so far has been dispatched and heard. */
const heard = () => new Promise((next) => setTimeout(next, 0));
const where = (s: Selection, client?: MosaicClient) => String([s.predicate(client)].flat().filter(Boolean).join(" AND "));

describe("bridgeSelection", () => {
  it("publishes the inner clauses to the outer selection as one clause, through the map, from the bridge", async () => {
    const { outer, inner, tiles, brush, options } = page();
    bridgeSelection(inner, outer, semiJoinOf("dense_id", "Person_rel", { label: "Dashboard" }), options());
    inner.update(brush(tiles[0], [2, 5]));
    inner.update(clausePoint("Person.team", 1, { source: tiles[1] }));
    await heard();

    expect(outer.clauses).toHaveLength(1);
    expect(String(outer.clauses[0]!.predicate)).toBe(
      `("dense_id" IN (SELECT "dense_id" FROM "Person_rel" WHERE ("Person.score" BETWEEN 2 AND 5) AND ("Person.team" IN (1))))`,
    );
    expect(outer.clauses[0]!.meta).toEqual({ type: "semijoin", label: "Dashboard" });
  });

  it("names the inner clauses a mapped clause was made of, and retracts one of them alone", async () => {
    const { outer, inner, tiles, brush, options } = page();
    bridgeSelection(inner, outer, semiJoinOf("dense_id", "Person_rel", { label: "Dashboard" }), options());
    const score = brush(tiles[0], [2, 5]);
    const team = clausePoint("Person.team", 1, { source: tiles[1] });
    inner.update(score);
    inner.update(team);
    await heard();

    const parts = bridged(outer.clauses[0]!);
    expect(parts?.parts).toEqual([score, team]);
    parts?.retract([score]);
    await heard();
    expect(inner.clauses).toEqual([team]);
    expect(bridged(outer.clauses[0]!)?.parts).toEqual([team]);
    expect(bridged(team)).toBeNull();
  });

  it("does not filter a client by its own clause on either side, and never echoes the mapped clause inward", async () => {
    const { outer, inner, tiles, graph, brush, options } = page();
    bridgeSelection(inner, outer, semiJoinOf("dense_id", "Person_rel"), options());
    inner.update(brush(tiles[0], [2, 5]));
    await heard();
    expect(where(inner, tiles[0])).toBe("");
    // The mapped clause never comes back in, so no tile is filtered by it.
    expect(where(inner, tiles[1])).toBe(`("Person.score" BETWEEN 2 AND 5)`);
    expect(inner.clauses).toHaveLength(1);
    expect(where(outer, graph)).toContain(`"dense_id" IN (SELECT`);

    const pick = clauseSemiJoin("dense_id", [3, 4], { source: graph });
    outer.update(pick);
    await heard();
    // The page's clause arrives as itself, so the graph stays exempt and the tiles are filtered by it.
    expect(inner.clauses).toContain(pick);
    expect(where(inner, tiles[0])).toBe(`("dense_id" IN (3, 4))`);
    expect(where(outer, graph)).not.toContain("(3, 4)");
    // Nothing that arrived from the page was mapped back out.
    expect(String(outer.clauses.find((c) => c !== pick)?.predicate)).not.toContain("(3, 4)");
    expect(outer.clauses).toHaveLength(2);
  });

  it("hands the page's clauses in when the page emits them, and maps none of them back out", async () => {
    const { outer, inner, tiles, graph, brush, options } = page();
    // A listener still running — the coordinator's queries — holds the page's next emit back.
    let release = () => {};
    outer.addEventListener("value", () => new Promise<void>((done) => (release = done)));
    bridgeSelection(inner, outer, semiJoinOf("dense_id", "Person_rel"), options());
    inner.update(brush(tiles[0], [2, 5]));
    await heard();
    outer.update(clauseSemiJoin("dense_id", [3, 4], { source: graph }));
    await heard();
    release();
    await heard();
    expect(outer.clauses.map((c) => String(c.predicate)).join(" ")).not.toContain("IN (3, 4)) AND");
    expect(outer.clauses.filter((c) => String(c.predicate).includes("SELECT"))).toHaveLength(1);
    expect(String(outer.clauses.find((c) => String(c.predicate).includes("SELECT"))?.predicate)).not.toContain("3, 4");
  });

  it("withdraws the mapped clause when the inner clauses go, by update or by reset", async () => {
    const { outer, inner, tiles, brush, options } = page();
    bridgeSelection(inner, outer, semiJoinOf("dense_id", "Person_rel"), options());
    inner.update(brush(tiles[0], [2, 5]));
    await heard();
    inner.update(brush(tiles[0], null));
    await heard();
    expect([...outer.clauses]).toEqual([]);

    const clause = brush(tiles[1], [1, 3]);
    inner.update(clause);
    await heard();
    expect(outer.clauses).toHaveLength(1);
    inner.reset([clause]);
    await heard();
    expect([...outer.clauses]).toEqual([]);
  });

  it("calls the bridge back when the mapped clause is retracted where it was published, and clears the inner sources", async () => {
    const { outer, inner, tiles, brush, options } = page();
    bridgeSelection(inner, outer, semiJoinOf("dense_id", "Person_rel"), options());
    const cleared = vi.fn();
    inner.update(brush(tiles[0], [2, 5], cleared));
    await heard();
    outer.reset([...outer.clauses]);
    await heard();
    expect(cleared).toHaveBeenCalled();
    expect([...inner.clauses]).toEqual([]);
    expect([...outer.clauses]).toEqual([]);
  });

  it("retracts the inner clauses where their owner says, when the mapped clause is retracted", async () => {
    const { outer, inner, tiles, brush, options } = page();
    // A chart's own selection, upstream of the inner one: a reset of `inner` alone never reaches it.
    const chart = Selection.union();
    const view = Selection.crossfilter({ include: [chart] });
    const retract = vi.fn((clauses: SelectionClause[]) => void chart.reset(clauses));
    bridgeSelection(view, outer, semiJoinOf("dense_id", "Person_rel"), options({ retract }));
    chart.update(brush(tiles[0], [2, 5]));
    await heard();
    outer.reset([...outer.clauses]);
    await heard();
    expect(retract).toHaveBeenCalled();
    expect([...chart.clauses]).toEqual([]);
    expect([...view.clauses]).toEqual([]);
    expect([...outer.clauses]).toEqual([]);
    expect(inner.clauses).toHaveLength(0);
  });

  it("resets an outer clause on the outer selection when the inner selection resets it", async () => {
    const { outer, inner, graph, options } = page();
    const cleared = vi.fn();
    const pick = clauseSemiJoin("dense_id", [3], { source: Object.assign(graph, { reset: cleared }) });
    outer.update(pick);
    const fresh = Selection.crossfilter();
    bridgeSelection(fresh, outer, semiJoinOf("dense_id", "Person_rel"), options());
    // What stood on the page before the bridge reaches the inner clients at once.
    expect([...fresh.clauses]).toEqual([pick]);
    fresh.reset();
    await heard();
    expect([...outer.clauses]).toEqual([]);
    expect(cleared).toHaveBeenCalled();
    expect(inner.clauses).toHaveLength(0);
  });

  it("maps with the function it is given, and withdraws what it published when it is unbridged", async () => {
    const { outer, inner, tiles, brush, options } = page();
    const map = vi.fn((clauses: readonly SelectionClause[], source: object) => clausePoint("n", clauses.length, { source }));
    inner.update(brush(tiles[0], [2, 5]));
    const unbridge = bridgeSelection(inner, outer, map, options());
    expect(String(outer.clauses[0]!.predicate)).toBe(`("n" IN (1))`);
    unbridge();
    await heard();
    expect([...outer.clauses]).toEqual([]);
    inner.update(brush(tiles[1], [1, 2]));
    await heard();
    expect([...outer.clauses]).toEqual([]);
    expect(map).toHaveBeenCalledOnce();
  });
});
