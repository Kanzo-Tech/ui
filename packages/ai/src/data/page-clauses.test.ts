import { clausePoints, crossfilterOver, onRelation, relationOver } from "@kanzo-tech/mosaic";
import { describe, expect, it } from "vitest";
import { NOBEL } from "../testing/nobel.js";
import { pageClauses } from "./answer.js";

const award = { as: "award", type: "LaureateAward" } as const;
/** Prizes by their category, and by their university: two patterns of Nobel as fossil wrote it. */
const byCategory = relationOver(NOBEL, [award, { edge: "category", direction: "out" }, { as: "category", type: "Category" }]);
const byUniversity = relationOver(NOBEL, [award, { edge: "university", direction: "out" }, { as: "university", type: "University" }]);

/** The dashboard's chip on Physics, published on the category pattern as its tile publishes it. */
const physics = onRelation(clausePoints(["category.name"], [["Physics"]], { source: {} }), byCategory);

describe("pageClauses", () => {
  it("crosses a chip on another pattern by the vertex both hold, as the page's tiles are crossed", () => {
    const selection = crossfilterOver(NOBEL);
    const page = pageClauses([physics], ["university.name"], { relation: byUniversity, resolver: selection.resolver });
    expect(page.unanswered).toEqual([]);
    expect(page.answered).toEqual([physics]);
    expect(String(page.predicates[0])).toMatch(/"award" IN \(SELECT "award" .*"category\.name"/s);
  });

  it("carries a chip along the graph's one shortest path to a pattern that holds none of its vertices", () => {
    const selection = crossfilterOver(NOBEL);
    const university = relationOver(NOBEL, [{ as: "university", type: "University" }]);
    const page = pageClauses([physics], ["university.name"], { relation: university, resolver: selection.resolver });
    expect(page.unanswered).toEqual([]);
    expect(String(page.predicates[0])).toMatch(/"university" IN \(SELECT/);
  });

  it("reads a chip published on the answer's own pattern as it is", () => {
    const selection = crossfilterOver(NOBEL);
    const page = pageClauses([physics], ["category.name"], { relation: byCategory, resolver: selection.resolver });
    expect(page.predicates).toEqual([physics.predicate]);
  });
});
