import { render, screen, waitFor } from "@testing-library/react";
import { clausePoint, Selection, type Coordinator, type MosaicClient } from "@uwdata/mosaic-core";
import { count } from "@uwdata/vgplot";
import { describe, expect, it } from "vitest";
import { ChartStat } from "./chart-stat.js";
import { MosaicProvider } from "./mosaic-provider.js";

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
      return Promise.resolve().then(() => {
        client.queryResult(answer(String(query)));
        client.update();
      });
    },
    clear() {},
  };
  return { connected: listeners, coordinator: coordinator as unknown as Coordinator, queries };
}

const wrap = (coordinator: Coordinator, crossfilter: Selection, node: React.ReactNode) =>
  render(
    <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
      {node}
    </MosaicProvider>,
  );

describe("ChartStat", () => {
  it("shows the aggregate the relation answers, compacted", async () => {
    const crossfilter = Selection.crossfilter();
    const { coordinator, queries } = stubCoordinator(() => [{ value: 12_900 }]);

    wrap(coordinator, crossfilter, <ChartStat label="Rows" table="telemetry" value={count()} />);

    expect(await screen.findByText("12.9K")).toBeTruthy();
    expect(queries[0]).toContain('FROM "telemetry"');
  });

  it("re-asks when the crossfilter moves — the whole reason it is not a plain query", async () => {
    const crossfilter = Selection.crossfilter();
    const { coordinator, queries } = stubCoordinator((sql) =>
      sql.includes("region") ? [{ value: 42 }] : [{ value: 4233 }],
    );

    wrap(coordinator, crossfilter, <ChartStat label="Rows" table="telemetry" value={count()} />);
    expect(await screen.findByText("4,233")).toBeTruthy();

    // Via a variable: `ClauseSource` is `object & { reset?() }`, so an inline literal trips
    // excess property checking on `id`.
    const source = { id: "elsewhere" };
    crossfilter.update(clausePoint("region", "Galicia", { source }));
    await waitFor(() => expect(screen.getByText("42")).toBeTruthy());
    expect(queries.at(-1)).toContain("region");
  });

  it("formats through the caller when asked, and disconnects on unmount", async () => {
    const crossfilter = Selection.crossfilter();
    const { connected, coordinator } = stubCoordinator(() => [{ value: 0.42 }]);

    const view = wrap(
      coordinator,
      crossfilter,
      <ChartStat
        format={(v) => `${(v * 100).toFixed(1)}%`}
        label="Flagged"
        table="telemetry"
        value={count()}
      />,
    );

    expect(await screen.findByText("42.0%")).toBeTruthy();
    view.unmount();
    expect(connected.size).toBe(0);
  });
});
