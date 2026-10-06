import { MosaicClient, Selection, clauseInterval, clausePoint, type SelectionClause } from "@uwdata/mosaic-core";
import { describe, expect, it, vi } from "vitest";
import { relaySelection } from "./relay.js";

/** A chart's own selection, born after the page's crossfilter it feeds, and two charts on the page. */
function page() {
  const chart = Selection.union();
  const crossfilter = Selection.crossfilter();
  const [mine, other] = [new MosaicClient(crossfilter), new MosaicClient(crossfilter)] as const;
  const brush = (range: [number, number] | null) => clauseInterval("hour", range, { source: mine, clients: new Set([mine]) });
  return { chart, crossfilter, mine, other, brush };
}

/** The clauses `selection` holds are exactly these objects — by identity, since a copy is the bug. */
const holds = (selection: Selection, ...clauses: SelectionClause[]) => {
  expect(selection.clauses).toHaveLength(clauses.length);
  clauses.forEach((clause, i) => expect(selection.clauses[i]).toBe(clause));
};

/** Until every value event queued so far has been dispatched and heard. */
const heard = () => new Promise((next) => setTimeout(next, 0));
const where = (s: Selection, client?: MosaicClient) => String([s.predicate(client)].flat().filter(Boolean).join(" AND "));

describe("relaySelection", () => {
  it("puts the clause object itself into the target, so the publisher stays exempt from its own clause", async () => {
    const { chart, crossfilter, mine, other, brush } = page();
    relaySelection(chart, crossfilter);
    const clause = brush([2, 5]);
    chart.update(clause);
    await heard();

    holds(crossfilter, clause);
    expect(where(crossfilter, mine)).toBe("");
    expect(where(crossfilter, other)).toBe(`("hour" BETWEEN 2 AND 5)`);
  });

  it("relays what the source already held when it is wired", () => {
    const { chart, crossfilter, brush } = page();
    const clause = brush([1, 3]);
    chart.update(clause);
    relaySelection(chart, crossfilter);
    holds(crossfilter, clause);
  });

  it("follows a reset out, which emits no event of its own", async () => {
    const { chart, crossfilter, brush } = page();
    relaySelection(chart, crossfilter);
    chart.update(brush([2, 5]));
    await heard();
    chart.reset();
    await heard();
    holds(crossfilter);
  });

  it("follows a clause replaced by its source, keeping only the latest", async () => {
    const { chart, crossfilter, brush } = page();
    relaySelection(chart, crossfilter);
    chart.update(brush([2, 5]));
    const latest = brush([3, 6]);
    chart.update(latest);
    await heard();
    holds(crossfilter, latest);
  });

  // Mosaic queues the values raised while one is being dispatched, and may drop the ones between.
  it("loses nothing in a burst: the last delivery holds the latest state", async () => {
    const { chart, crossfilter, other, brush } = page();
    relaySelection(chart, crossfilter);
    for (let hi = 1; hi <= 20; hi++) chart.update(brush([0, hi]));
    const pick = clausePoint("kind", "Person", { source: other });
    chart.update(pick);
    await heard();
    expect(crossfilter.clauses.map((c) => String(c.predicate))).toEqual([`("hour" BETWEEN 0 AND 20)`, String(pick.predicate)]);
  });

  it("forwards activation, so a target can warm the query a gesture is about to ask", () => {
    const { chart, crossfilter, brush } = page();
    relaySelection(chart, crossfilter);
    const heardActivate = vi.fn();
    crossfilter.addEventListener("activate", heardActivate);
    const clause = brush([2, 5]);
    chart.activate(clause);
    expect(heardActivate).toHaveBeenCalledWith(clause);
  });

  it("withdraws what it relayed when stopped, even with the source's reset still queued", async () => {
    const { chart, crossfilter, brush } = page();
    const stop = relaySelection(chart, crossfilter);
    chart.update(brush([2, 5]));
    chart.update(brush([2, 6])); // queued behind the first dispatch
    chart.reset();
    stop();
    await heard();
    holds(crossfilter);
  });

  it("stops relaying when stopped", async () => {
    const { chart, crossfilter, brush } = page();
    relaySelection(chart, crossfilter)();
    chart.update(brush([2, 5]));
    await heard();
    holds(crossfilter);
  });

  it("leaves out the source it is told to, and reports what it moves", async () => {
    const { chart, crossfilter, other, brush } = page();
    const arrived = vi.fn();
    const withdrawn = vi.fn();
    relaySelection(chart, crossfilter, { except: other, onArrive: arrived, onWithdraw: withdrawn });
    const clause = brush([2, 5]);
    chart.update(clause);
    chart.update(clausePoint("kind", "Person", { source: other }));
    await heard();
    holds(crossfilter, clause);
    expect(arrived).toHaveBeenCalledWith(clause);
    chart.reset();
    await heard();
    expect(withdrawn).toHaveBeenCalledWith(clause);
  });
});
