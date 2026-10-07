import { act, render, screen, waitFor } from "@testing-library/react";
import { clausePoint, Selection, type Coordinator, type MosaicClient } from "@uwdata/mosaic-core";
import { Query } from "@uwdata/mosaic-sql";
import { describe, expect, it } from "vitest";
import { MosaicClients, MosaicProvider } from "./mosaic-provider.js";
import { useChartQuery } from "./use-chart-query.js";

/**
 * `MosaicClients` over the move a real coordinator makes when a selection changes: it asks the
 * client to update, and the client — `MosaicClient.requestQuery` — asks only while it is enabled.
 */
function stubCoordinator() {
  const queries: string[] = [];
  const coordinator = {
    connect(client: MosaicClient) {
      client.coordinator = coordinator as unknown as Coordinator;
      client.initialize();
      client.filterBy?.addEventListener("value", () => void client.requestQuery());
    },
    disconnect(client: MosaicClient) {
      client.coordinator = null;
    },
    requestQuery(client: MosaicClient, query: unknown) {
      queries.push(String(query));
      return Promise.resolve().then(() => client.queryResult([{ n: queries.length }]).update());
    },
    clear() {},
  };
  return { coordinator: coordinator as unknown as Coordinator, queries };
}

function Count() {
  const { row } = useChartQuery({ query: (filter) => Query.from("t").select({ n: "n" }).where(filter) });
  return <p>{row ? String(row.n) : "…"}</p>;
}

describe("MosaicClients", () => {
  it("asks nothing while disabled, keeps its rows, and runs the query it was owed once enabled", async () => {
    const { coordinator, queries } = stubCoordinator();
    const crossfilter = Selection.crossfilter();
    const page = (enabled: boolean) => (
      <MosaicProvider coordinator={coordinator} crossfilter={crossfilter}>
        <MosaicClients enabled={enabled}>
          <Count />
        </MosaicClients>
      </MosaicProvider>
    );
    const { rerender } = render(page(true));
    await waitFor(() => expect(screen.getByText("1")).toBeTruthy());

    rerender(page(false));
    await act(async () => {
      crossfilter.update(clausePoint("a", 1, { source: { reset() {} } }));
      crossfilter.update(clausePoint("a", 2, { source: { reset() {} } }));
    });
    expect(queries).toHaveLength(1);
    expect(screen.getByText("1")).toBeTruthy();

    rerender(page(true));
    await waitFor(() => expect(screen.getByText("2")).toBeTruthy());
    expect(queries).toHaveLength(2);
  });
});
