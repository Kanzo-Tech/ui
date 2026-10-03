import { Selection } from "@uwdata/mosaic-core";
import { Query, eq, isBetween, literal } from "@uwdata/mosaic-sql";
import { describe, expect, it } from "vitest";
import { clauseColumns, clauseSemiJoin } from "./clause.js";

const source = { reset() {} };

describe("the clause rule", () => {
  it("builds a semi-join on identity from keys, or from a statement that selects them", () => {
    const ids = clauseSemiJoin("dense_id", [3, 4], { source, label: "Lasso" });
    expect(String(ids.predicate)).toBe(`("dense_id" IN (3, 4))`);
    expect(ids.meta).toEqual({ type: "semijoin", label: "Lasso" });
    expect(ids.value).toEqual([3, 4]);

    const found = Query.select("dst").from("knows").where(eq("src", literal(3)));
    const joined = clauseSemiJoin("dense_id", found, { source });
    expect(String(joined.predicate)).toBe(`("dense_id" IN (SELECT "dst" FROM "knows" WHERE ("src" = 3)))`);
    expect(joined.value).toBe(found);
  });

  it("clears with null and keeps nothing with an empty list, as clausePoints does", () => {
    expect(clauseSemiJoin("dense_id", null, { source }).predicate).toBeNull();
    expect(String(clauseSemiJoin("dense_id", [], { source }).predicate)).toBe("FALSE");
  });

  it("names the key alone: a subquery's columns are another relation's", () => {
    const found = Query.select("dst").from("knows").where(eq("src", literal(3)));
    expect(clauseColumns(clauseSemiJoin("dense_id", found, { source }).predicate!)).toEqual(["dense_id"]);
    expect(clauseColumns([isBetween("score", [2, 5]), eq("name", literal("Ada")), eq("score", literal(1))])).toEqual([
      "score",
      "name",
    ]);
  });

  it("is retracted where it was published, and exempts its own source when that is a client", () => {
    const selection = Selection.crossfilter();
    let reset = 0;
    const publisher = { reset: () => void reset++ };
    const clause = clauseSemiJoin("dense_id", [1], { source: publisher });
    selection.update(clause);
    expect(selection.clauses).toContain(clause);
    selection.reset([clause]);
    expect(reset).toBe(1);
    expect(clause.clients).toBeUndefined();
  });
});
