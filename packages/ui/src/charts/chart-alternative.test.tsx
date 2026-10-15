import { engineOver } from "../../test/engine";
import { render, screen, waitFor, within } from "@testing-library/react";
import type { Coordinator, MosaicClient } from "@uwdata/mosaic-core";
import { count } from "@kanzo-tech/mosaic";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ALT_ROWS, ChartAlternative, readAlternatives, type AlternativeMark } from "./chart-alternative.js";
import { ChartBarY } from "./chart-marks.js";
import { ChartRoot } from "./chart-root.js";
import { MosaicProvider } from "./mosaic-provider.js";

const columns = (rows: Record<string, unknown>[]): AlternativeMark["data"] => ({
  numRows: rows.length,
  columns: Object.fromEntries(Object.keys(rows[0] ?? {}).map((k) => [k, rows.map((r) => r[k] as never)])),
});

const bars = (rows: Record<string, unknown>[], filterBy?: unknown): AlternativeMark => ({
  channels: [
    { channel: "x", field: "region", as: "region" },
    { channel: "y", field: count(), as: "n" },
  ],
  data: columns(rows),
  filterBy,
});

describe("readAlternatives", () => {
  it("reads a mark's plain fields as the key of a row and its aggregates as the values", () => {
    const [table] = readAlternatives([bars([{ region: "North", n: 4 }, { region: "South", n: 6 }], {})], { n: { label: "Sightings" } });
    expect(table).toEqual({ keys: 1, columns: ["region", "Sightings"], rows: [["North", 4], ["South", 6]] });
  });

  it("puts the kept layer and the context layer of a crossfiltered chart in one table, as numbers", () => {
    const context = bars([{ region: "North", n: 10 }, { region: "South", n: 8 }], null);
    const kept = bars([{ region: "North", n: 3 }], {});
    const tables = readAlternatives([context, kept]);
    expect(tables).toHaveLength(1);
    expect(tables[0]).toEqual({
      keys: 1,
      columns: ["region", "n (all rows)", "n"],
      rows: [["North", 10, 3], ["South", 8, undefined]],
    });
  });

  it("reads nothing from a mark that has not been answered", () => {
    expect(readAlternatives([{ channels: [{ channel: "x", field: "region", as: "region" }] }])).toEqual([]);
  });
});

describe("ChartAlternative", () => {
  const table = { keys: 1, columns: ["region", "n"], rows: [["North", 4], ["South", 1234]] };

  it("is a table named by the chart's title, with a header cell for each row", () => {
    render(<ChartAlternative title="Sightings by region" tables={[table]} />);
    const grid = screen.getByRole("table", { name: "Sightings by region" });
    expect(within(grid).getAllByRole("columnheader").map((c) => c.textContent)).toEqual(["region", "n"]);
    expect(within(grid).getAllByRole("rowheader").map((c) => c.textContent)).toEqual(["North", "South"]);
    expect(within(grid).getAllByRole("cell").map((c) => c.textContent)).toEqual(["4", new Intl.NumberFormat().format(1234)]);
  });

  it("is a summary past ALT_ROWS: how many marks, the largest and the smallest", () => {
    const rows = Array.from({ length: ALT_ROWS + 1 }, (_, i) => [`bar ${i}`, i + 1]);
    render(<ChartAlternative title="Many" tables={[{ ...table, rows }]} />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText(/^Many: 51 marks\. Largest: bar 50, 51\. Smallest: bar 0, 1\./)).toBeTruthy();
  });

  it("is nothing where nothing was drawn", () => {
    const { container } = render(<ChartAlternative title="Empty" tables={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("a ChartRoot's text alternative", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private readonly report: ResizeObserverCallback) {}
        observe() {
          this.report([{ contentRect: { width: 400 } } as ResizeObserverEntry], this as unknown as ResizeObserver);
        }
        disconnect() {}
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("renders the answer its marks received as a table, and hides the picture from assistive technology", async () => {
    const coordinator = {
      clear() {},
      connect(client: MosaicClient) {
        queueMicrotask(() => {
          (client as unknown as { queryResult(rows: object[]): { update(): unknown } })
            .queryResult([{ region: "North", y: 4 }, { region: "South", y: 6 }])
            .update();
        });
      },
      disconnect() {},
    } as unknown as Coordinator;
    const { container } = render(
      <MosaicProvider engine={engineOver(coordinator)}>
        <ChartRoot aria-label="Sightings by region" relation="sightings">
          <ChartBarY x="region" y={count()} />
        </ChartRoot>
      </MosaicProvider>,
    );
    const grid = await screen.findByRole("table", { name: "Sightings by region" }, { timeout: 5_000 });
    await waitFor(() => expect(within(grid).getAllByRole("rowheader").map((c) => c.textContent)).toEqual(["North", "South"]));
    expect(container.querySelector("[data-slot=chart]")?.getAttribute("aria-hidden")).toBe("true");
  });
});
