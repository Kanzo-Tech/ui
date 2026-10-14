import { asTableRef } from "@uwdata/mosaic-sql";
import { clausePoints, crossfilterOver, onRelation, type JoinGraph, type Relation } from "@kanzo-tech/mosaic";
import { describe, expect, it } from "vitest";
import { pageClauses } from "./answer.js";

const at = (table: string) => asTableRef(["jobs/7", table])!;
const type = (name: string) => ({ name, table: at(name), key: "id", columns: [{ name: "name", type: "VARCHAR" }] });
const edge = (source: string, label: string, destination: string) => ({
  name: `${source}_${label}_${destination}`,
  label,
  source,
  destination,
  table: at(`${source}_${label}_${destination}`),
  src: "src",
  dst: "dst",
});

/** Nobel's shape: a prize between its category and its university; a country on its own. */
const NOBEL: JoinGraph = {
  types: [type("LaureateAward"), type("Category"), type("University"), type("Country")],
  edges: [edge("LaureateAward", "category", "Category"), edge("LaureateAward", "university", "University")],
};
const byCategory: Relation = { root: "LaureateAward", path: [{ edge: "LaureateAward_category_Category", direction: "out" }] };
const byUniversity: Relation = { root: "LaureateAward", path: [{ edge: "LaureateAward_university_University", direction: "out" }] };

/** The dashboard's chip on Physics, published on the category relation as its tile publishes it. */
const physics = onRelation(clausePoints(["Category.name"], [["Physics"]], { source: {} }), byCategory);

describe("pageClauses", () => {
  it("crosses a chip on another relation by the key both reach, as the page's tiles are crossed", () => {
    const selection = crossfilterOver(NOBEL);
    const page = pageClauses([physics], ["University.name"], { relation: byUniversity, resolver: selection.resolver });
    expect(page.unanswered).toEqual([]);
    expect(page.answered).toEqual([physics]);
    expect(String(page.predicates[0])).toMatch(/"id" IN \(SELECT "id" FROM .*"Category\.name"/s);
  });

  it("keeps none of a relation's rows when it shares no type with the chip's", () => {
    const selection = crossfilterOver(NOBEL);
    const country: Relation = { root: "Country", path: [] };
    const page = pageClauses([physics], ["Country.name"], { relation: country, resolver: selection.resolver });
    expect(page.predicates).toEqual([]);
    expect(page.unanswered).toEqual([{ clause: physics, missing: ["Category.name"] }]);
  });

  it("reads a chip published on the answer's own relation as it is", () => {
    const selection = crossfilterOver(NOBEL);
    const page = pageClauses([physics], ["Category.name"], { relation: byCategory, resolver: selection.resolver });
    expect(page.predicates).toEqual([physics.predicate]);
  });
});
