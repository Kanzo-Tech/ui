import { Coordinator, MosaicClient, type Connector } from "@uwdata/mosaic-core";
import { Query } from "@uwdata/mosaic-sql";
import { tableFromArrays, tableToIPC } from "@uwdata/flechette";
import { describe, expect, it, vi } from "vitest";

/**
 * **A client that leaves takes its queued queries with it.** A page tears down in an order no one
 * chooses: a clause withdrawn as the page goes makes the clients still connected query again, those
 * queries wait in the coordinator's queue, and the clients disconnect before they run. Whatever the
 * page held — an attached catalog, a registered file — may be released by then, so a query that
 * outlives its client fails against nothing, and is logged as a failure nobody had.
 *
 * Held against mosaic-core's own `Coordinator`: what is asserted is its contract, which
 * `patches/@uwdata__mosaic-core@0.32.0.patch` carries.
 */

/** A connector that answers `exec` only when told to, so what is queued behind it stays queued. The
 * coordinators below cache nothing, so a query asked again reaches it again. */
function gated() {
  const asked: string[] = [];
  let open = () => {};
  // Mosaic's `Connector.query` is an overload per request type; one body answers both.
  const connector = {
    async query({ type, sql }: { type: string; sql: string }) {
      asked.push(sql);
      if (type === "exec") return void (await new Promise<void>((resolve) => (open = resolve)));
      return tableToIPC(tableFromArrays({ n: [1] }), {});
    },
  } as Connector;
  return { connector, asked, open: () => open() };
}

/** A tile over `table`. */
class Tile extends MosaicClient {
  failed = vi.fn();
  constructor(readonly table: string) {
    super();
  }
  override query() {
    return Query.select({ n: 1 }).from(this.table);
  }
  override queryError(error: Error) {
    this.failed(error);
    return this;
  }
}

const settled = () => new Promise((next) => setTimeout(next, 0));

describe("disconnecting a client", () => {
  it("cancels the query it had queued: it never runs, and nothing reports it", async () => {
    const { connector, asked, open } = gated();
    const logger = { log: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), group: vi.fn(), groupCollapsed: vi.fn(), groupEnd: vi.fn() };
    const coordinator = new Coordinator(connector, { logger, cache: false });
    coordinator.manager.consolidate(false);

    const tile = new Tile("airports");
    coordinator.connect(tile);
    await settled();
    asked.length = 0;

    // An exec in flight holds the queue, as a page's own statements do; the filter changes as the
    // page goes, so the tile asks again, and leaves before its query runs.
    const held = coordinator.exec("SELECT 'held'");
    void coordinator.requestQuery(tile, tile.query());
    coordinator.disconnect(tile);

    open();
    await held;
    await settled();

    expect(asked).toEqual(["SELECT 'held'"]);
    expect(tile.failed).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("leaves the queries of the clients that stay", async () => {
    const { connector, asked, open } = gated();
    const coordinator = new Coordinator(connector, { cache: false });
    coordinator.manager.consolidate(false);

    const [leaving, staying] = [new Tile("airports"), new Tile("routes")];
    coordinator.connect(leaving);
    coordinator.connect(staying);
    await settled();
    asked.length = 0;

    const held = coordinator.exec("SELECT 'held'");
    void coordinator.requestQuery(leaving, leaving.query());
    void coordinator.requestQuery(staying, staying.query());
    coordinator.disconnect(leaving);

    open();
    await held;
    await settled();

    expect(asked.filter((sql) => sql !== "SELECT 'held'")).toEqual(['SELECT 1 AS "n" FROM "routes"']);
    expect(staying.failed).not.toHaveBeenCalled();
  });
});
