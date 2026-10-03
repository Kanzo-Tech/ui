import { MosaicClient, Selection, clauseInterval, clausePoint, type SelectionClause } from "@uwdata/mosaic-core";
import { describe, expect, it, vi } from "vitest";
import { bridgeSelection } from "./bridge.js";
import { clauseSemiJoin, semiJoinOf } from "./clause.js";

/** Two tiles crossfiltering inside a dashboard, and a graph beside it on the page. */
function page() {
  const outer = Selection.crossfilter();
  const inner = Selection.crossfilter();
  const tiles = [new MosaicClient(inner), new MosaicClient(inner)] as const;
  const graph = new MosaicClient(outer);
  const brush = (tile: MosaicClient, range: [number, number] | null, reset = () => {}) =>
    clauseInterval("Person.score", range, { source: Object.assign(tile, { reset }), clients: new Set([tile]) });
  return { outer, inner, tiles, graph, brush };
}

const where = (s: Selection, client?: MosaicClient) => String([s.predicate(client)].flat().filter(Boolean).join(" AND "));

describe("bridgeSelection", () => {
  it("publishes the inner clauses to the outer selection as one clause, through the map, from the bridge", () => {
    const { outer, inner, tiles, brush } = page();
    bridgeSelection(inner, outer, semiJoinOf("dense_id", "Person_rel", { label: "Dashboard" }));
    inner.update(brush(tiles[0], [2, 5]));
    inner.update(clausePoint("Person.team", 1, { source: tiles[1] }));

    expect(outer.clauses).toHaveLength(1);
    expect(String(outer.clauses[0]!.predicate)).toBe(
      `("dense_id" IN (SELECT "dense_id" FROM "Person_rel" WHERE ("Person.score" BETWEEN 2 AND 5) AND ("Person.team" IN (1))))`,
    );
    expect(outer.clauses[0]!.meta).toEqual({ type: "semijoin", label: "Dashboard" });
    expect(inner.clauses.map((c) => c.source)).toEqual([tiles[0], tiles[1]]);
  });

  it("does not filter a client by its own clause on either side, and never echoes the mapped clause inward", () => {
    const { outer, inner, tiles, graph, brush } = page();
    bridgeSelection(inner, outer, semiJoinOf("dense_id", "Person_rel"));
    inner.update(brush(tiles[0], [2, 5]));
    expect(where(inner, tiles[0])).toBe("");
    expect(where(inner, tiles[1])).toBe(`("Person.score" BETWEEN 2 AND 5)`);
    expect(where(outer, graph)).toContain(`"dense_id" IN (SELECT`);

    const pick = clauseSemiJoin("dense_id", [3, 4], { source: graph });
    outer.update(pick);
    // The page's clause arrives as itself, so the graph stays exempt and the tiles are filtered by it.
    expect(inner.clauses).toContain(pick);
    expect(where(inner, tiles[0])).toBe(`("dense_id" IN (3, 4))`);
    expect(where(outer, graph)).not.toContain("(3, 4)");
    // Nothing that arrived from the page was mapped back out, and the mapped clause never came in.
    expect(String(outer.clauses.find((c) => c !== pick)?.predicate)).not.toContain("(3, 4)");
    expect(inner.clauses.every((c) => c === pick || c.source === tiles[0])).toBe(true);
  });

  it("withdraws the mapped clause when the inner clauses go, by update or by reset", () => {
    const { outer, inner, tiles, brush } = page();
    bridgeSelection(inner, outer, semiJoinOf("dense_id", "Person_rel"));
    inner.update(brush(tiles[0], [2, 5]));
    inner.update(brush(tiles[0], null));
    expect([...outer.clauses]).toEqual([]);

    const clause = brush(tiles[1], [1, 3]);
    inner.update(clause);
    expect(outer.clauses).toHaveLength(1);
    inner.reset([clause]);
    expect([...outer.clauses]).toEqual([]);
  });

  it("calls the bridge back when the mapped clause is retracted where it was published, and clears the inner sources", () => {
    const { outer, inner, tiles, brush } = page();
    bridgeSelection(inner, outer, semiJoinOf("dense_id", "Person_rel"));
    const cleared = vi.fn();
    inner.update(brush(tiles[0], [2, 5], cleared));
    outer.reset([...outer.clauses]);
    expect(cleared).toHaveBeenCalledOnce();
    expect([...inner.clauses]).toEqual([]);
    expect([...outer.clauses]).toEqual([]);
  });

  it("retracts the inner clauses where their owner says, when the mapped clause is retracted", () => {
    const { outer, inner, tiles, brush } = page();
    // A chart's own selection, upstream of the inner one: a reset of `inner` alone never reaches it.
    const chart = Selection.union();
    chart._relay.add(inner);
    const retract = vi.fn((clauses: SelectionClause[]) => void chart.reset(clauses));
    bridgeSelection(inner, outer, semiJoinOf("dense_id", "Person_rel"), { retract });
    chart.update(brush(tiles[0], [2, 5]));
    outer.reset([...outer.clauses]);
    expect(retract).toHaveBeenCalledOnce();
    expect([...chart.clauses]).toEqual([]);
    expect([...inner.clauses]).toEqual([]);
    expect([...outer.clauses]).toEqual([]);
  });

  it("resets an outer clause on the outer selection when the inner selection resets it", () => {
    const { outer, inner, graph } = page();
    const cleared = vi.fn();
    const pick = clauseSemiJoin("dense_id", [3], { source: Object.assign(graph, { reset: cleared }) });
    outer.update(pick);
    bridgeSelection(inner, outer, semiJoinOf("dense_id", "Person_rel"));
    // What stood on the page before the bridge reaches the inner clients at once.
    expect([...inner.clauses]).toEqual([pick]);
    inner.reset();
    expect([...outer.clauses]).toEqual([]);
    expect(cleared).toHaveBeenCalled();
  });

  it("maps with the function it is given, and withdraws what it published when it is unbridged", () => {
    const { outer, inner, tiles, brush } = page();
    const map = vi.fn((clauses: readonly SelectionClause[], source: object) => clausePoint("n", clauses.length, { source }));
    inner.update(brush(tiles[0], [2, 5]));
    const unbridge = bridgeSelection(inner, outer, map);
    expect(String(outer.clauses[0]!.predicate)).toBe(`("n" IN (1))`);
    unbridge();
    expect([...outer.clauses]).toEqual([]);
    inner.update(brush(tiles[1], [1, 2]));
    expect([...outer.clauses]).toEqual([]);
    expect(map).toHaveBeenCalledOnce();
  });
});
