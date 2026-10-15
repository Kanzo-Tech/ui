import { engineOver } from "../../test/engine";
import { render, screen, waitFor } from "@testing-library/react";
import { clausePoint, QueryError, Selection, type Coordinator, type MosaicClient } from "@uwdata/mosaic-core";
import { verbatim } from "@uwdata/mosaic-sql";
import { count } from "@uwdata/vgplot";
import { describe, expect, it, vi } from "vitest";
import { ChartStat } from "./chart-stat.js";
import { MosaicProvider, useMosaic } from "./mosaic-provider.js";

/** The page's selection, which the provider owns: handed out from inside it. */
function Page({ into }: { into: (selection: Selection) => void }) {
  into(useMosaic().selection);
  return null;
}


/**
 * The same coordinator double the input tests use: it plays the moves a real one makes against a
 * client — connect, answer `query()`, re-ask when the client's `filterBy` moves — over fixed rows.
 * jsdom has no DuckDB, and the point of these two is precisely that they re-ask.
 */
type Row = Record<string, unknown>;

function stubCoordinator(answer: (sql: string) => Row[]) {
  const listeners = new Map<MosaicClient, () => void>();
  const queries: string[] = [];
  const coordinator = {
    connect(client: MosaicClient) {
      client.coordinator = coordinator as unknown as Coordinator;
      client.initialize();
      const selection = client.filterBy;
      if (!selection) return;
      const rerun = () => {
        const filter = selection.predicate(client);
        if (!filter) return;
        coordinator.requestQuery(client, client.query(filter));
      };
      selection.addEventListener("value", rerun);
      listeners.set(client, rerun);
    },
    disconnect(client: MosaicClient) {
      const rerun = listeners.get(client);
      if (rerun) client.filterBy?.removeEventListener("value", rerun);
      listeners.delete(client);
      client.coordinator = null;
    },
    requestQuery(client: MosaicClient, query: unknown) {
      if (query == null) return Promise.resolve();
      queries.push(String(query));
      // As `Coordinator.updateClient` does: a rejected query goes to the client's `queryError`,
      // wrapped in a `QueryError` holding it as `cause` — which the client unwraps for the host.
      return Promise.resolve()
        .then(() => answer(String(query)))
        .then(
          (rows) => client.queryResult(rows).update(),
          (error: unknown) => client.queryError(new QueryError(error, String(query))),
        );
    },
    clear() {},
  };
  return { connected: listeners, coordinator: coordinator as unknown as Coordinator, queries };
}

/** The page selection of the last `wrap`. */
let page!: Selection;

const wrap = (
  coordinator: Coordinator,
  node: React.ReactNode,
  onFailure?: (error: unknown) => void,
) =>
  render(
    <MosaicProvider engine={engineOver(coordinator)} onFailure={onFailure}>
        <Page into={(s) => (page = s)} />
      {node}
    </MosaicProvider>,
  );

describe("ChartStat", () => {
  it("shows the aggregate the relation answers, compacted", async () => {
    const { coordinator, queries } = stubCoordinator(() => [{ value: 12_900 }]);

    wrap(coordinator, <ChartStat relation="telemetry" value={count()} />);

    expect(await screen.findByText("12.9K")).toBeTruthy();
    expect(queries[0]).toContain('FROM "telemetry"');
  });

  it("reads a relation in another catalog, qualified as the SQL names it", async () => {
    const { coordinator, queries } = stubCoordinator(() => [{ value: 3 }]);

    wrap(coordinator, <ChartStat relation={verbatim('"jobs/7"."Person"')} value={count()} />);

    expect(await screen.findByText("3")).toBeTruthy();
    expect(queries[0]).toContain('FROM "jobs/7"."Person"');
  });

  it("re-asks when the crossfilter moves — the whole reason it is not a plain query", async () => {
    const { coordinator, queries } = stubCoordinator((sql) =>
      sql.includes("region") ? [{ value: 42 }] : [{ value: 4233 }],
    );

    wrap(coordinator, <ChartStat relation="telemetry" value={count()} />);
    expect(await screen.findByText("4,233")).toBeTruthy();

    // Via a variable: `ClauseSource` is `object & { reset?() }`, so an inline literal trips
    // excess property checking on `id`.
    const source = { id: "elsewhere" };
    page.update(clausePoint("region", "Galicia", { source }));
    await waitFor(() => expect(screen.getByText("42")).toBeTruthy());
    expect(queries.at(-1)).toContain("region");
  });

  it("formats through the caller when asked, and disconnects on unmount", async () => {
    const { connected, coordinator } = stubCoordinator(() => [{ value: 0.42 }]);

    const view = wrap(
      coordinator,
      <ChartStat
        format={(v) => `${(v * 100).toFixed(1)}%`}
        relation="telemetry"
        value={count()}
      />,
    );

    expect(await screen.findByText("42.0%")).toBeTruthy();
    view.unmount();
    expect(connected.size).toBe(0);
  });

  it("shows a failed read as a failure, not as a figure or a skeleton, and hands the host the thrown value", async () => {
    const failure = Object.assign(new Error("Catalog Error: Table telemetry does not exist"), { code: "x/y" });
    const onFailure = vi.fn();
    const { coordinator } = stubCoordinator(() => {
      throw failure;
    });

    const view = wrap(coordinator, <ChartStat relation="telemetry" value={count()} />, onFailure);

    expect(await screen.findByText("Could not be read")).toBeTruthy();
    expect(view.container.querySelector("[data-slot=stat-value]")?.getAttribute("aria-busy")).toBeNull();
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0]![0]).toBe(failure);
  });
});
