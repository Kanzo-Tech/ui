import { Selection, clauseInterval, clauseMatch, clausePoint, clausePoints } from "@kanzo-tech/mosaic";
import { describe, expect, it, vi } from "vitest";
import { fakeCorpus } from "../../test/corpus";
import { graphClient, translate } from "./filter";
import { createGraph } from "./store";

/**
 * The bridge from the page's crossfilter to scan's typed filter, against a real Mosaic `Selection`.
 * What it cannot prove is that fossil renders what this builds as the SQL it means — fossil's own
 * tests do.
 */

const chart = graphClient();

function graphOver(crossfilter: Selection) {
  const fake = fakeCorpus();
  const onFailure = vi.fn();
  const store = createGraph({ corpus: fake.corpus, fill: "cluster_id", filterBy: crossfilter, onFailure });
  store.subscribe(() => {});
  return { fake, onFailure, store };
}

describe("a Mosaic predicate as scan's filter", () => {
  it("translates the clauses a chart publishes", () => {
    expect(translate(clauseInterval("degree", [2, 5], { source: chart }).predicate)).toEqual({
      and: [
        { column: "degree", op: ">=", value: 2 },
        { column: "degree", op: "<=", value: 5 },
      ],
    });
    expect(translate(clausePoint("kind", "beast", { source: chart }).predicate)).toEqual({
      column: "kind",
      op: "in",
      values: ["beast"],
    });
    expect(translate(clausePoints(["kind"], [["beast"], ["region"]], { source: chart }).predicate)).toEqual({
      column: "kind",
      op: "in",
      values: ["beast", "region"],
    });
  });

  // Mosaic queues a `value` event behind one whose listeners have not settled, so the second
  // arrives a microtask later.
  it("is re-asked when the page filters something", async () => {
    const crossfilter = Selection.crossfilter();
    const { fake, store } = graphOver(crossfilter);
    const filtered = () => fake.scans.filter((scan) => scan.filter !== undefined);
    crossfilter.update(clauseInterval("degree", [2, 5], { source: chart }));
    expect(filtered().map((scan) => scan.table)).toEqual(["Person", "Place"]);
    expect(filtered()[0]?.filter).toEqual({
      and: [
        { column: "degree", op: ">=", value: 2 },
        { column: "degree", op: "<=", value: 5 },
      ],
    });
    crossfilter.update(clauseInterval("degree", null, { source: chart }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(filtered()).toHaveLength(2);
    await fake.settle();
    expect(store.getSnapshot().mask).toBeNull();
  });

  it("is exempt from a clause that names it", () => {
    const crossfilter = Selection.crossfilter();
    const { fake, store } = graphOver(crossfilter);
    const before = fake.scans.length;
    store.select([3, 4], "marquee", "Marquee");
    expect(fake.scans).toHaveLength(before);
    expect(String(crossfilter.predicate(chart))).toContain("dense_id");
  });

  it("reports a node it cannot translate, and never draws the unfiltered picture as filtered", () => {
    const crossfilter = Selection.crossfilter();
    const { fake, onFailure } = graphOver(crossfilter);
    const before = fake.scans.length;
    crossfilter.update(clauseMatch("label", "grey", { source: chart, method: "contains" }));
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0]?.[0]).toMatchObject({ code: "graph/untranslatable-filter" });
    expect(fake.scans).toHaveLength(before);
  });
});
