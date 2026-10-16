import { clausePoints } from "@kanzo-tech/mosaic";
import { crossfilterOver, onRelation, type Relation } from "@kanzo-tech/relations";
import { describe, expect, it } from "vitest";
import { NOBEL } from "../testing/nobel.js";
import { pageClauses } from "./answer.js";

/** Prizes by their category, and by their university: two relations of Nobel as fossil wrote it. */
const byCategory: Relation = { root: "LaureateAward", path: [{ edge: "LaureateAward_category_Category", direction: "out" }] };
const byUniversity: Relation = { root: "LaureateAward", path: [{ edge: "LaureateAward_university_University", direction: "out" }] };

/** The dashboard's chip on Physics, published on the category relation as its tile publishes it. */
const physics = onRelation(clausePoints(["category.name"], [["Physics"]], { source: {} }), byCategory);

describe("pageClauses", () => {
  it("crosses a chip on another relation by the key both reach, as the page's tiles are crossed", () => {
    const selection = crossfilterOver(NOBEL);
    const page = pageClauses([physics], ["university.name"], { relation: byUniversity, resolver: selection.resolver });
    expect(page.unanswered).toEqual([]);
    expect(page.answered).toEqual([physics]);
    expect(String(page.predicates[0])).toMatch(/"dense_id" IN \(SELECT "dense_id" FROM .*"category\.name"/s);
  });

  it("keeps none of a relation's rows when it shares no type with the chip's", () => {
    const selection = crossfilterOver(NOBEL);
    const country: Relation = { root: "Country", path: [] };
    const page = pageClauses([physics], ["name"], { relation: country, resolver: selection.resolver });
    expect(page.predicates).toEqual([]);
    expect(page.unanswered).toEqual([{ clause: physics, missing: ["category.name"] }]);
  });

  it("reads a chip published on the answer's own relation as it is", () => {
    const selection = crossfilterOver(NOBEL);
    const page = pageClauses([physics], ["category.name"], { relation: byCategory, resolver: selection.resolver });
    expect(page.predicates).toEqual([physics.predicate]);
  });
});
