import { stubCoordinator } from "../../test/coordinator";
import { engineOver } from "../../test/engine";
import { act, render, screen, waitFor } from "@testing-library/react";
import { clausePoint, Selection } from "@uwdata/mosaic-core";
import { Query } from "@uwdata/mosaic-sql";
import type { JoinGraph, JoinResolver } from "@kanzo-tech/relations";
import { describe, expect, it } from "vitest";
import { MosaicClients, MosaicProvider, useMosaic } from "./mosaic-provider.js";
import { useChartQuery } from "./use-chart-query.js";

/** The page's selection, which the provider owns: handed out from inside it. */
function Page({ into }: { into: (selection: Selection) => void }) {
  into(useMosaic().selection);
  return null;
}


/** A coordinator whose every answer is how many queries it has been asked. */
function counting() {
  const stub = stubCoordinator(() => [{ n: stub.queries.length }]);
  return stub;
}

function Count() {
  const { row } = useChartQuery({ query: (filter) => Query.from("t").select({ n: "n" }).where(filter) });
  return <p>{row ? String(row.n) : "…"}</p>;
}

describe("MosaicClients", () => {
  it("asks nothing while disabled, keeps its rows, and runs the query it was owed once enabled", async () => {
    const { coordinator, queries } = counting();
    let crossfilter!: Selection;
    const page = (enabled: boolean) => (
      <MosaicProvider engine={engineOver(coordinator)}>
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
    const { coordinator } = counting();
    let crossfilter!: Selection;
    const graph = (): JoinGraph => ({ types: [], edges: [] });
    const first = graph();
    const page = (joins: JoinGraph) => (
      <MosaicProvider engine={engineOver(coordinator)} joins={joins}>
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
