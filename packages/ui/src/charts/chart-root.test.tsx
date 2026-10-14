import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Coordinator, Selection } from "@uwdata/mosaic-core";
import { firstDrawsPending, type JoinGraph } from "@kanzo-tech/mosaic";
import { ChartAxisX } from "./chart-axes.js";
import { ChartLegend } from "./chart-legend.js";
import { ChartToggleX } from "./chart-interactors.js";
import { ChartBarY } from "./chart-marks.js";
import { ChartRoot, useChartContext, type ChartContextValue } from "./chart-root.js";
import { MosaicClients, MosaicProvider, useMosaic, type MosaicContextValue } from "./mosaic-provider.js";

/**
 * Render smoke only. vgplot needs a live coordinator to produce an SVG, and `TokenizedPlot`
 * measures its container before building anything — under jsdom the width stays 0, so the plot is
 * never built here. The grammar itself is covered by `chart-spec.test.tsx`.
 */
const coordinator = { clear() {} } as unknown as Coordinator;

const Chart = ({ children }: { children?: React.ReactNode }) => (
  <MosaicProvider coordinator={coordinator}>
    <ChartRoot config={{ cpu: { label: "CPU" }, mem: { label: "Memory", color: "#123456" } }} relation="telemetry">
      <ChartBarY x="host" y="n" />
      <ChartAxisX tickRotate={45} />
      <ChartToggleX />
      {children}
    </ChartRoot>
  </MosaicProvider>
);

describe("ChartRoot", () => {
  it("renders the root and its plot host, and no DOM for the descriptors", () => {
    const { container } = render(<Chart />);

    const root = container.querySelector("[data-slot=chart-root]");
    expect(root).not.toBeNull();
    expect(root?.querySelector("[data-slot=chart]")).not.toBeNull();
    // Marks, axes and interactors are inert: the plot host and nothing else.
    expect(root?.children).toHaveLength(1);
  });

  it("feeds ChartLegend the root's config, with the label as the accessible channel", () => {
    render(<Chart>{<ChartLegend />}</Chart>);

    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["CPU", "Memory"]);
    // Colour is never the only channel: the swatch is hidden from assistive tech.
    expect(items[1]?.querySelector("[aria-hidden]")).toHaveProperty("style.background", "rgb(18, 52, 86)");
  });

  it("exposes the series colour and a locale number formatter through useChartContext", () => {
    const Readout = () => {
      const chart = useChartContext();
      return <span data-testid="readout">{`${chart.color("mem")} ${chart.formatNumber(1234.5)}`}</span>;
    };
    render(<Chart>{<Readout />}</Chart>);

    expect(screen.getByTestId("readout").textContent).toBe(`#123456 ${new Intl.NumberFormat().format(1234.5)}`);
  });

  it("throws outside a ChartRoot rather than silently rendering an empty chart", () => {
    const Orphan = () => {
      useChartContext();
      return null;
    };
    expect(() => render(<Orphan />)).toThrow(/useChartContext/);
  });
});

/**
 * The page's one selection. Every root filters by it and publishes into it; the provider owns it, so
 * nobody passes one. jsdom never builds the plot, so what is pinned here is the wiring: which
 * selection, which relation, and the first draw the root holds while it has not drawn.
 */
describe("ChartRoot on the page's selection", () => {
  const JOINS: JoinGraph = {
    types: [{ name: "Person", table: "people", key: "dense_id", columns: ["age"] }],
    edges: [],
  };

  function wire(node: React.ReactNode, joins?: JoinGraph) {
    const roots: ChartContextValue[] = [];
    let mosaic!: MosaicContextValue;
    const Probe = () => {
      roots.push(useChartContext());
      return null;
    };
    const Context = () => {
      mosaic = useMosaic();
      return null;
    };
    const view = render(
      <MosaicProvider coordinator={coordinator} joins={joins}>
        <Context />
        {node}
        <ChartRoot relation="telemetry">
          <ChartBarY x="region" y="n" />
          <Probe />
        </ChartRoot>
      </MosaicProvider>,
    );
    return { roots, mosaic: () => mosaic, view };
  }

  it("filters by and publishes into the provider's one selection, a crossfilter", () => {
    const { roots, mosaic } = wire(null);
    expect(roots.at(-1)?.selection).toBe(mosaic().selection);
    expect(mosaic().selection.resolver.cross).toBe(true);
  });

  it("names its relation to the page: a table by name, a type of the joins read as its table", () => {
    const { roots } = wire(null);
    expect(roots.at(-1)).toMatchObject({ relation: "telemetry", table: "telemetry" });

    const typed: ChartContextValue[] = [];
    const Probe = () => {
      typed.push(useChartContext());
      return null;
    };
    render(
      <MosaicProvider coordinator={coordinator} joins={JOINS}>
        <ChartRoot relation="Person">
          <Probe />
        </ChartRoot>
        <ChartRoot relation={{ root: "Person", path: [] }}>
          <Probe />
        </ChartRoot>
      </MosaicProvider>,
    );
    expect(typed[0]).toMatchObject({ relation: "Person", table: "people" });
    expect(String(typed[1]?.table)).toBe('SELECT "dense_id", "age" FROM "people"');
  });

  it("holds the page's first draw while it asks and has not drawn, and lets go when it stops asking or unmounts", () => {
    const { mosaic, view } = wire(null);
    // jsdom never draws: the chart is still pending.
    expect(firstDrawsPending(mosaic().selection)).toBe(1);
    view.rerender(
      <MosaicProvider coordinator={coordinator}>
        <MosaicClients enabled={false}>
          <ChartRoot relation="telemetry" />
        </MosaicClients>
      </MosaicProvider>,
    );
    view.unmount();
    expect(firstDrawsPending(mosaic().selection)).toBe(0);
  });

  it("does not hold the first draw from under a MosaicClients that is off", () => {
    let page!: Selection;
    const Context = () => {
      page = useMosaic().selection;
      return null;
    };
    render(
      <MosaicProvider coordinator={coordinator}>
        <Context />
        <MosaicClients enabled={false}>
          <ChartRoot relation="telemetry" />
        </MosaicClients>
      </MosaicProvider>,
    );
    expect(firstDrawsPending(page)).toBe(0);
  });
});

describe("ChartLegend", () => {
  it("still works standalone from a `series` list, on the categorical scheme", () => {
    render(<ChartLegend series={["a", "b"]} />);

    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["a", "b"]);
    // The swatch wears the slot token rather than a resolved colour: the browser resolves it, and
    // that is what makes the legend follow the active scheme and the theme without re-rendering.
    expect(items[0]?.querySelector("[aria-hidden]")).toHaveProperty("style.background", "var(--chart-1)");
  });
});
