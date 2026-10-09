import { Selection, clauseInterval, clausePoint, clausePoints, type SelectionClause } from "@uwdata/mosaic-core";
import { Query, eq, isBetween, literal } from "@uwdata/mosaic-sql";
import { describe, expect, it } from "vitest";
import { antiJoinOf, clauseColumns, clauseLabel, clauseParts, clauseSemiJoin } from "./clause.js";

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

  it("crosses clauses on some rows as an anti-join, which keeps every row the table does not hold", () => {
    const window = clauseInterval("born", [1902, 1905], { source });
    const crossed = antiJoinOf("dense_id", "timed", { label: "born" })([window], source);
    expect(String(crossed.predicate)).toBe(
      `(NOT ("dense_id" IN (SELECT "dense_id" FROM "timed" WHERE (NOT coalesce(("born" BETWEEN 1902 AND 1905), FALSE)))))`,
    );
    expect(clauseColumns(crossed.predicate!)).toEqual(["dense_id"]);
    expect(crossed.meta).toEqual({ type: "semijoin", label: "born" });
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

describe("what a clause says", () => {
  const findings = Query.select("dense_id").from("findings");
  const day = new Date(2026, 9, 5);
  // [what, clause, parts, line] — every column clause shape a chip or a summary is handed.
  const cases: [string, SelectionClause, { field: string; value: string | null }, string][] = [
    ["a point", clausePoint("region", "Saltmere", { source }), { field: "region", value: "Saltmere" }, "region Saltmere"],
    ["a set of one", clausePoints(["beast"], [["harpy"]], { source }), { field: "beast", value: "harpy" }, "beast harpy"],
    ["a set of n", clausePoints(["beast"], [["harpy"], ["wyrm"]], { source }), { field: "beast", value: "2 selected" }, "beast · 2 selected"],
    ["a numeric range", clauseInterval("hour", [6, 13.5], { source }), { field: "hour", value: "6 – 13.5" }, "hour 6 – 13.5"],
    ["a date range", clauseInterval("seen", [day, day], { source }), { field: "seen", value: `${day.toLocaleDateString()} – ${day.toLocaleDateString()}` }, `seen ${day.toLocaleDateString()} – ${day.toLocaleDateString()}`],
    ["a cleared clause", clausePoint("region", undefined, { source }), { field: "region", value: null }, "region"],
  ];

  it.each(cases)("reads %s without the database's quoting", (_, clause, parts, line) => {
    expect(clauseParts(clause)).toEqual(parts);
    expect(clauseLabel(clause)).toBe(line);
  });

  it("names a semi-join by its publisher's label, and counts its members when they are keys", () => {
    const lasso = clauseSemiJoin("dense_id", [3, 4], { source, label: "Lasso" });
    expect(clauseParts(lasso)).toEqual({ field: "Lasso", value: "2 selected" });
    expect(clauseLabel(lasso)).toBe("Lasso · 2 selected");
    const rule = clauseSemiJoin("dense_id", findings, { source, label: "Missing name" });
    expect(clauseParts(rule)).toEqual({ field: "Missing name", value: null });
    expect(clauseLabel(rule)).toBe("Missing name");
    expect(clauseLabel(clauseSemiJoin("dense_id", findings, { source }))).toBe("dense_id");
  });
});
