import { describe, expect, it, vi } from "vitest";
import { Coordinator, Selection } from "@kanzo-tech/ui/analytics";
import { SUPERSEDED } from "./bounded";
import { SliceRead } from "./slice-client";

/**
 * The protocol a source queries through, asserted against a real coordinator.
 *
 * The connector is a stub and everything above it is Mosaic's own: a real `Coordinator`, a real
 * `Selection`, real clause resolution. That is deliberate — the claims here are all about what the
 * *coordinator* does with a client, and a fake coordinator would only re-assert what this file
 * believes, which is precisely the belief that was wrong before. `onceQuery` connected a client per
 * query and disconnected it a microtask later, so no selection could ever reach it; nothing in the
 * repository failed, because nothing asked.
 *
 * ## What these cannot prove
 *
 * - **Nothing about SQL being correct SQL.** The stub answers every string the same way, so a query
 *   that DuckDB would reject reads here as a pass. `docs/showcases/graph-bench` is where a query
 *   meets an engine.
 * - **Nothing about timing.** Consolidation is switched off below, so the frame the real
 *   consolidator waits on — `requestAnimationFrame`, which does not fire in a hidden tab — is not
 *   exercised. A latency measured under this harness would be a fiction.
 * - **Nothing about the coordinator's own re-query on a selection change.** That path is
 *   `updateSelection`'s and it is asserted here through a real `Selection`; what it cannot see is
 *   whether a *host* wired `watch`, which is `use-query-loop.test.tsx`'s.
 */

/** Every query the coordinator issued, and a fixed answer for each. */
function harness() {
  const asked: string[] = [];
  const connector = {
    query: ({ sql }: { sql: string }) => {
      asked.push(sql);
      return Promise.resolve([{ n: 1 }]);
    },
  };
  // Consolidation off: it defers every batch by a frame, and a test that waited for one would be
  // measuring jsdom's `requestAnimationFrame` rather than the protocol. Cache off for the same
  // reason in reverse — two identical queries must both reach the stub or `asked` under-counts.
  const coordinator = new Coordinator(connector as never, {
    logger: null,
    consolidate: false,
    cache: false,
  });
  return { asked, coordinator };
}

describe("a source's read is a client of the page's coordinator", () => {
  it("builds its SQL around the predicate the coordinator hands it", async () => {
    const { asked, coordinator } = harness();
    const crossfilter = Selection.crossfilter();
    const read = new SliceRead(coordinator, crossfilter);

    crossfilter.update({
      source: { name: "a panel" },
      fields: ["kind"],
      value: "member",
      predicate: "kind = 'member'",
    } as never);

    await read.ask((filter) => `SELECT 1 WHERE ${String(filter)}`);
    expect(asked.at(-1)).toContain("kind = 'member'");
    read.release();
  });

  /**
   * The claim the whole change rests on, stated as a behaviour rather than as a shape.
   *
   * A greyout needed a *second* question — which ids survive? — because the drawing query could not
   * be told about the filters. A client's can: the coordinator walks every client of a selection
   * when it updates and calls `query(filter)` again, with no camera and no host involved.
   */
  it("is re-queried by the coordinator when the page filters something", async () => {
    const { asked, coordinator } = harness();
    const crossfilter = Selection.crossfilter();
    const read = new SliceRead(coordinator, crossfilter);
    const pushed = vi.fn();
    read.onAnswer = pushed;

    await read.ask((filter) => `SELECT x WHERE ${String(filter) || "TRUE"}`);
    const before = asked.length;

    crossfilter.update({
      source: { name: "a panel" },
      fields: ["kind"],
      value: "beast",
      predicate: "kind = 'beast'",
    } as never);
    await coordinator.filterGroups.get(crossfilter)?.selection.value;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(asked.length).toBeGreaterThan(before);
    expect(asked.at(-1)).toContain("kind = 'beast'");
    // Nobody was waiting on a promise, so the answer is reported rather than dropped — which is what
    // lets a source hand the host a finished slice instead of asking it to ask again.
    expect(pushed).toHaveBeenCalled();
    read.release();
  });

  /**
   * A clause the graph published is a clause the graph is exempt from.
   *
   * The exemption is a crossfilter's whole point and this source declines nothing: with the
   * predicate in the drawing query rather than over the picture, taking your own clause means a
   * lasso deletes everything you did not lasso. `IdSetClient` could decline it because it *faded*,
   * and its own comment says so.
   */
  it("is exempt from a clause that names it", async () => {
    const { asked, coordinator } = harness();
    const crossfilter = Selection.crossfilter();
    const read = new SliceRead(coordinator, crossfilter);
    await read.ask((filter) => `SELECT x WHERE ${String(filter) || "TRUE"}`);

    crossfilter.update({
      source: read,
      clients: new Set([read]),
      fields: ["id"],
      value: [[1]],
      predicate: "id IN (1)",
    } as never);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(asked.join("\n")).not.toContain("id IN (1)");
    read.release();
  });

  /**
   * A camera moves faster than a database answers, and the previous caller is still holding a
   * promise. Dropping it leaves that caller's `finally` unrun, which in the query loop reads as a
   * request permanently in flight.
   */
  it("settles a superseded question rather than dropping it", async () => {
    const { coordinator } = harness();
    const read = new SliceRead(coordinator);
    const first = read.ask(() => "SELECT 1");
    const second = read.ask(() => "SELECT 2");
    await expect(first).rejects.toBe(SUPERSEDED);
    await expect(second).resolves.toBeDefined();
    read.release();
  });

  it("stops being walked once it is released", async () => {
    const { asked, coordinator } = harness();
    const crossfilter = Selection.crossfilter();
    const read = new SliceRead(coordinator, crossfilter);
    await read.ask((filter) => `SELECT x WHERE ${String(filter) || "TRUE"}`);
    read.release();
    const after = asked.length;

    crossfilter.update({
      source: { name: "a panel" },
      fields: ["kind"],
      value: "tag",
      predicate: "kind = 'tag'",
    } as never);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(asked.length).toBe(after);
  });

  /**
   * Pre-aggregation is declined by a getter rather than by failing an analysis.
   *
   * `preaggColumns` would reach the same answer — a slice is a CTE over window functions and is a
   * string, not a `SelectQuery` — but only after calling `query()` on every selection change to
   * find out. The claim is also simply true: the filter decides which rows are numbered, so it moves
   * the groupby domain, which is the question `filterStable` asks.
   */
  it("declines pre-aggregation, because the filter moves what it groups", () => {
    const { coordinator } = harness();
    expect(new SliceRead(coordinator).filterStable).toBe(false);
  });
});
