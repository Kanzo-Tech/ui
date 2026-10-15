import { act, render, screen, waitFor } from "@testing-library/react";
import { clausePoint, Selection, type Coordinator, type MosaicClient } from "@uwdata/mosaic-core";
import { Query } from "@uwdata/mosaic-sql";
import type { JoinGraph, JoinResolver } from "@kanzo-tech/mosaic";
import { describe, expect, it } from "vitest";
import { MosaicClients, MosaicProvider, useMosaic } from "./mosaic-provider.js";
import { useChartQuery } from "./use-chart-query.js";

/** The page's selection, which the provider owns: handed out from inside it. */
function Page({ into }: { into: (selection: Selection) => void }) {
  into(useMosaic().selection);
  return null;
}


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
    let crossfilter!: Selection;
    const page = (enabled: boolean) => (
      <MosaicProvider coordinator={coordinator}>
        <Page into={(s) => (crossfilter = s)} />
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

describe("MosaicProvider", () => {
  it("keeps the page's selection and its clauses when `joins` is a new graph, and hands the resolver the new one", () => {
    const { coordinator } = stubCoordinator();
    let crossfilter!: Selection;
    const graph = (): JoinGraph => ({ types: [], edges: [] });
    const first = graph();
    const page = (joins: JoinGraph) => (
      <MosaicProvider coordinator={coordinator} joins={joins}>
        <Page into={(s) => (crossfilter = s)} />
      </MosaicProvider>
    );
    const { rerender } = render(page(first));
    const before = crossfilter;
    act(() => before.update(clausePoint("a", 1, { source: { reset() {} } })));
    expect(before.clauses).toHaveLength(1);

    const second = graph();
    rerender(page(second));
    expect(crossfilter).toBe(before);
    expect(crossfilter.clauses).toHaveLength(1);
    expect((crossfilter.resolver as JoinResolver).joins).toBe(second);
  });
});
