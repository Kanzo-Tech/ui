import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { clausePoint, Selection, type Coordinator, type SelectionClause } from "@uwdata/mosaic-core";
import { ChartAxisX } from "./chart-axes.js";
import { ChartLegend } from "./chart-legend.js";
import { ChartToggleX } from "./chart-interactors.js";
import { ChartBarY } from "./chart-marks.js";
import { ChartRoot, useChart } from "./chart-root.js";
import { MosaicProvider, useMosaic, type MosaicContextValue } from "./mosaic-provider.js";

/**
 * Render smoke only. vgplot needs a live coordinator to produce an SVG, and `TokenizedPlot`
 * measures its container before building anything — under jsdom the width stays 0, so the plot is
 * never built here. The grammar itself is covered by `chart-spec.test.tsx`.
 */
const coordinator = { clear() {} } as unknown as Coordinator;

const Chart = ({ children }: { children?: React.ReactNode }) => (
  <MosaicProvider coordinator={coordinator}>
    <ChartRoot config={{ cpu: { label: "CPU" }, mem: { label: "Memory", color: "#123456" } }} table="telemetry">
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

  it("exposes the series colour and a locale number formatter through useChart", () => {
    const Readout = () => {
      const chart = useChart();
      return <span data-testid="readout">{`${chart.color("mem")} ${chart.formatNumber(1234.5)}`}</span>;
    };
    render(<Chart>{<Readout />}</Chart>);

    expect(screen.getByTestId("readout").textContent).toBe(`#123456 ${new Intl.NumberFormat().format(1234.5)}`);
  });

  it("throws outside a ChartRoot rather than silently rendering an empty chart", () => {
    const Orphan = () => {
      useChart();
      return null;
    };
    expect(() => render(<Orphan />)).toThrow(/useChart/);
  });
});

/**
 * The per-chart selection. Not a preference: `ChartHighlight` appends its `by` predicate as a
 * column on the mark's own GROUP BY query, so a page-wide `by` is a binder error the moment a
 * second chart filters by a second column — and a failed query leaves the plot showing stale
 * pixels, with nothing but a console line to say so. These tests pin the wiring that prevents it.
 */
describe("ChartRoot selections", () => {
  /** Renders `count` charts and hands back their `as` selections plus the provider context. */
  function wire(count: number, as?: Selection) {
    const roots: Selection[] = [];
    let mosaic!: MosaicContextValue;

    const Probe = () => {
      roots.push(useChart().as);
      return null;
    };
    const Context = () => {
      mosaic = useMosaic();
      return null;
    };
    const view = render(
      <MosaicProvider coordinator={coordinator}>
        <Context />
        {Array.from({ length: count }, (_, i) => (
          <ChartRoot as={as} key={i} table="telemetry">
            <ChartBarY x="region" y="n" />
            <Probe />
          </ChartRoot>
        ))}
      </MosaicProvider>,
    );
    return { roots, mosaic, view };
  }

  const clause = (selection: Selection, field: string, value: string): SelectionClause => {
    // Via a variable: `ClauseSource` is `object & { reset?() }`, so an inline literal trips excess
    // property checking on `id`.
    const source = { id: `${field}:${value}` };
    const published = clausePoint(field, value, { source });
    selection.update(published);
    return published;
  };

  it("gives each root its own selection, distinct from the provider's shared pair", () => {
    const { roots, mosaic } = wire(2);

    expect(roots).toHaveLength(2);
    expect(roots[0]).not.toBe(roots[1]);
    expect(roots[0]).not.toBe(mosaic.selected);
    expect(roots[0]).not.toBe(mosaic.crossfilter);
    // Plain unions: a crossfilter would hide the chart's own clause from the chart itself.
    expect(roots[0]?.resolver.cross).toBe(false);
  });

  it("keeps one root's clause out of another root's selection, while both reach the crossfilter", () => {
    const { roots, mosaic } = wire(2);
    const [first, second] = roots as [Selection, Selection];

    clause(first, "region", "eu");
    clause(second, "provider", "aws");

    expect(first.clauses.map((c) => c.source)).toEqual([{ id: "region:eu" }]);
    expect(second.clauses.map((c) => c.source)).toEqual([{ id: "provider:aws" }]);
    expect(mosaic.crossfilter.clauses).toHaveLength(2);
    expect(mosaic.selected.clauses).toHaveLength(2);
  });

  it("relays the clause object itself, so the crossfilter still exempts the chart that published it", () => {
    const { roots, mosaic } = wire(1);
    const published = clause(roots[0] as Selection, "region", "eu");

    // Identity, not a copy: `skip()` reads `clause.clients`, and a copy would make the source
    // chart filter itself down to the bar you just clicked.
    expect(mosaic.crossfilter.clauses[0]).toBe(published);
  });

  it("clears every chart's selection through the provider's reset, not just the shared ones", () => {
    const { roots, mosaic } = wire(2);
    clause(roots[0] as Selection, "region", "eu");
    clause(roots[1] as Selection, "provider", "aws");

    // The gap this closes: a reset travels downstream only, so the crossfilter cannot clear them.
    mosaic.crossfilter.reset();
    expect(roots[0]?.clauses).toHaveLength(1);

    mosaic.reset();
    expect(roots[0]?.clauses).toHaveLength(0);
    expect(roots[1]?.clauses).toHaveLength(0);
    expect(mosaic.crossfilter.clauses).toHaveLength(0);
  });

  it("withdraws a chart's clause when the chart unmounts", () => {
    const { roots, mosaic, view } = wire(1);
    clause(roots[0] as Selection, "region", "eu");
    expect(mosaic.crossfilter.clauses).toHaveLength(1);

    view.unmount();
    expect(mosaic.crossfilter.clauses).toHaveLength(0);
  });

  it("leaves a caller-supplied `as` unrelayed — the caller wired it — but still resets it", () => {
    const mine = Selection.single();
    const { roots, mosaic } = wire(1, mine);
    expect(roots[0]).toBe(mine);

    clause(mine, "region", "eu");
    // Relaying it as well would push every clause into the crossfilter twice.
    expect(mosaic.crossfilter.clauses).toHaveLength(0);

    mosaic.reset();
    expect(mine.clauses).toHaveLength(0);
  });
});

describe("ChartLegend", () => {
  it("still works standalone from a `series` list, on the categorical palette", () => {
    render(<ChartLegend series={["a", "b"]} />);

    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["a", "b"]);
    expect(items[0]?.querySelector("[aria-hidden]")).toHaveProperty("style.background", "rgb(37, 99, 235)");
  });
});
