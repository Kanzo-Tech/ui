import { describe, expect, it } from "vitest";
import type { Selection } from "@uwdata/mosaic-core";
import { ChartAxisX, ChartAxisY, ChartFacetX, ChartFacetY } from "./chart-axes.js";
import { ChartColorLegend } from "./chart-legend.js";
import { ChartHighlight, ChartIntervalX, ChartPanZoom, ChartToggleX } from "./chart-interactors.js";
import { ChartBarY, ChartFrame, ChartGridY, ChartLineY, ChartRaw, ChartRuleY } from "./chart-marks.js";
import {
  buildChartSpec,
  chartSpecSignature,
  compileChartSpec,
  type ChartAttributeDirective,
  type ChartDirective,
  type ChartMarkDirective,
  type ChartSpecContext,
} from "./chart-spec.js";

const shared = { id: "shared" } as unknown as Selection;
const other = { id: "other" } as unknown as Selection;

const context = (over: Partial<ChartSpecContext> = {}): ChartSpecContext => ({
  table: "telemetry",
  filterBy: shared,
  as: shared,
  config: {},
  resolveColor: (token) => `rgb(${token})`,
  ...over,
});

const marks = (directives: ChartDirective[]) => directives.filter((d): d is ChartMarkDirective => d.kind === "mark");
const attributes = (directives: ChartDirective[]) =>
  Object.fromEntries(
    directives.filter((d): d is ChartAttributeDirective => d.kind === "attribute").map((d) => [d.name, d.value]),
  );

describe("compileChartSpec", () => {
  it("compiles descriptors to directives in source order", () => {
    const spec = compileChartSpec(
      <>
        <ChartBarY x="host" y="n" />
        <ChartRuleY at={0} />
        <ChartToggleX />
      </>,
      context(),
    );

    expect(spec.map((d) => d.kind)).toEqual(["mark", "mark", "interactor"]);
    expect(spec).toMatchObject([
      { mark: "barY", source: { kind: "table", table: "telemetry", filterBy: shared }, options: { x: "host", y: "n" } },
      { mark: "ruleY", source: { kind: "values", values: [0] } },
      { interactor: "toggleX", options: { as: shared } },
    ]);
  });

  it("ignores falsy children so conditionals work, and flattens fragments and arrays", () => {
    const show = false;
    const spec = compileChartSpec(
      <>
        {null}
        {undefined}
        {show && <ChartLineY x="t" />}
        {[<ChartBarY key="a" x="a" />, <ChartBarY key="b" x="b" />]}
        <>
          <ChartGridY />
        </>
      </>,
      context(),
    );

    expect(marks(spec).map((d) => d.mark)).toEqual(["barY", "barY", "gridY"]);
  });

  it("does not see a descriptor wrapped in a consumer component, nor real DOM children", () => {
    const Wrapped = () => <ChartBarY x="host" />;
    const spec = compileChartSpec(
      <>
        <Wrapped />
        <span>caption</span>
        <ChartBarY x="seen" />
      </>,
      context(),
    );

    expect(marks(spec)).toHaveLength(1);
    expect(marks(spec)[0]?.options).toEqual({ x: "seen" });
  });

  it("propagates filterBy: the root's by default, an override, or null for the full relation", () => {
    const spec = compileChartSpec(
      <>
        <ChartBarY x="a" />
        <ChartBarY x="b" filterBy={other} />
        <ChartBarY x="c" filterBy={null} />
      </>,
      context(),
    );

    expect(marks(spec).map((d) => d.source)).toEqual([
      { kind: "table", table: "telemetry", filterBy: shared },
      { kind: "table", table: "telemetry", filterBy: other },
      { kind: "table", table: "telemetry", filterBy: null },
    ]);
  });

  it("takes literal rows over the table, and `at` as a one-value data array", () => {
    const rows = [{ x: 1 }];
    const spec = compileChartSpec(
      <>
        <ChartBarY data={rows} x="x" />
        <ChartRuleY at={[0, 10]} />
      </>,
      context(),
    );

    expect(marks(spec).map((d) => d.source)).toEqual([
      { kind: "values", values: rows },
      { kind: "values", values: [0, 10] },
    ]);
    // The sugar never leaks into the mark options.
    expect(marks(spec)[0]?.options).toEqual({ x: "x" });
  });

  it("resolves colour tokens on fill/stroke and leaves column names alone", () => {
    const spec = compileChartSpec(
      <>
        <ChartBarY fill="var(--chart-1)" stroke="--primary" />
        <ChartBarY fill="host" stroke="#ff0000" />
      </>,
      context(),
    );

    expect(marks(spec)[0]?.options).toEqual({ fill: "rgb(var(--chart-1))", stroke: "rgb(--primary)" });
    // The column-valued fill also becomes the stacking series key — see `STACKING_MARKS`. A token
    // fill (the mark above) does not: it is a colour, not a series.
    expect(marks(spec)[1]?.options).toEqual({ fill: "host", stroke: "#ff0000", z: "host" });
  });

  it("gives interactors the root's target selection, with `by` for highlight and none for panZoom", () => {
    const spec = compileChartSpec(
      <>
        <ChartIntervalX />
        <ChartToggleX as={other} />
        <ChartHighlight opacity={0.2} />
        <ChartPanZoom zoom={false} />
        <ChartColorLegend />
      </>,
      context(),
    );

    expect(spec).toMatchObject([
      { kind: "interactor", interactor: "intervalX", options: { as: shared } },
      { kind: "interactor", interactor: "toggleX", options: { as: other } },
      { kind: "interactor", interactor: "highlight", options: { by: shared, opacity: 0.2 } },
      { kind: "interactor", interactor: "panZoom", options: { zoom: false } },
      { kind: "legend", channel: "color", options: { as: shared } },
    ]);
    expect(spec[3]).not.toHaveProperty("options.as");
  });

  it("compiles axes to prefixed plot attributes, keeping an explicit null", () => {
    const spec = compileChartSpec(
      <>
        <ChartAxisX anchor="bottom" tickRotate={45} label={null} />
        <ChartAxisY anchor={null} grid ticks={4} />
      </>,
      context(),
    );

    expect(attributes(spec)).toEqual({
      xAxis: "bottom",
      xTickRotate: 45,
      xLabel: null,
      yAxis: null,
      yGrid: true,
      yTicks: 4,
    });
  });

  it("passes fx/fy through as ordinary mark channels, on any mark", () => {
    const spec = compileChartSpec(
      <>
        <ChartBarY x="host" y="n" fx="region" />
        <ChartLineY x="t" y="n" fx="region" fy="tier" />
      </>,
      context(),
    );

    expect(marks(spec).map((d) => d.options)).toEqual([
      { x: "host", y: "n", fx: "region" },
      { x: "t", y: "n", fx: "region", fy: "tier" },
    ]);
  });

  it("compiles facet descriptors to fx/fy attributes, not to axisFx/axisFy marks", () => {
    const spec = compileChartSpec(
      <>
        <ChartFacetX anchor="top" domain={["eu", "us"]} tickRotate={45} padding={0.1} />
        <ChartFacetY anchor={null} grid label={null} reverse />
      </>,
      context(),
    );

    expect(marks(spec)).toHaveLength(0);
    expect(attributes(spec)).toEqual({
      fxAxis: "top",
      fxDomain: ["eu", "us"],
      fxTickRotate: 45,
      fxPadding: 0.1,
      fyAxis: null,
      fyGrid: true,
      fyLabel: null,
      fyReverse: true,
    });
  });

  it("passes a raw vgplot directive through untouched", () => {
    const directive = () => undefined;
    const spec = compileChartSpec(<ChartRaw spec={directive} />, context());
    expect(spec).toEqual([{ kind: "raw", value: directive }]);
  });

  it("uses the values shorthand for decorators and for a table-less root", () => {
    const spec = compileChartSpec(
      <>
        <ChartFrame stroke="#000" />
        <ChartBarY x="a" />
      </>,
      context({ table: undefined }),
    );

    expect(marks(spec).map((d) => d.source)).toEqual([null, { kind: "values", values: [{}] }]);
  });
});

describe("buildChartSpec", () => {
  const options = { children: null, width: 320, height: 200 };

  it("emits the frame attributes, with margins expanded per side", () => {
    expect(attributes(buildChartSpec({ ...options, margin: 8, aspectRatio: 2 }, context()))).toEqual({
      width: 320,
      height: 200,
      marginTop: 8,
      marginRight: 8,
      marginBottom: 8,
      marginLeft: 8,
      aspectRatio: 2,
    });
    expect(attributes(buildChartSpec({ ...options, margin: { left: 36 } }, context()))).toEqual({
      width: 320,
      height: 200,
      marginLeft: 36,
    });
    expect(attributes(buildChartSpec(options, context()))).toEqual({ width: 320, height: 200 });
  });

  it("expands the facet frame options, keeping an explicit null label", () => {
    expect(
      attributes(
        buildChartSpec({ ...options, facetMargin: { left: 12, top: 4 }, facetGrid: true, facetLabel: null }, context()),
      ),
    ).toEqual({
      width: 320,
      height: 200,
      facetMarginTop: 4,
      facetMarginLeft: 12,
      facetGrid: true,
      facetLabel: null,
    });
    expect(attributes(buildChartSpec({ ...options, facetMargin: 6 }, context()))).toEqual({
      width: 320,
      height: 200,
      facetMarginTop: 6,
      facetMarginRight: 6,
      facetMarginBottom: 6,
      facetMarginLeft: 6,
    });
  });

  it("turns a non-empty config into a pinned colour scale, falling back to the palette", () => {
    const spec = buildChartSpec(
      options,
      context({ config: { cpu: { color: "var(--chart-1)" }, mem: { label: "Memory" } } }),
    );

    expect(attributes(spec).colorDomain).toEqual(["cpu", "mem"]);
    expect(attributes(spec).colorRange).toEqual(["rgb(var(--chart-1))", "#ea580c"]);
  });

  it("emits no colour scale for an empty config", () => {
    const spec = buildChartSpec(options, context());
    expect(attributes(spec)).not.toHaveProperty("colorDomain");
  });

  it("appends the raw `attributes` escape hatch last, so it wins", () => {
    const raw = () => undefined;
    const spec = buildChartSpec({ ...options, children: <ChartBarY x="a" />, attributes: [raw] }, context());
    expect(spec.at(-1)).toEqual({ kind: "raw", value: raw });
  });
});

describe("chartSpecSignature", () => {
  const build = (x: string) => compileChartSpec(<ChartBarY x={x} filterBy={shared} />, context());

  it("is stable across equal specs and changes when the grammar does", () => {
    expect(chartSpecSignature(build("a"))).toBe(chartSpecSignature(build("a")));
    expect(chartSpecSignature(build("a"))).not.toBe(chartSpecSignature(build("b")));
  });

  it("fingerprints a SQL expression by its SQL, so a fresh `count()` does not rebuild the plot", () => {
    class Agg {
      toString() {
        return "COUNT(*)";
      }
    }
    const spec = (e: unknown) => compileChartSpec(<ChartBarY y={e} />, context());
    expect(chartSpecSignature(spec(new Agg()))).toContain("COUNT(*)");
    expect(chartSpecSignature(spec(new Agg()))).toBe(chartSpecSignature(spec(new Agg())));
  });

  it("keeps a selection stable by identity", () => {
    expect(chartSpecSignature(build("a"))).toBe(chartSpecSignature(build("a")));
    const withOther = compileChartSpec(<ChartBarY x="a" filterBy={other} />, context());
    expect(chartSpecSignature(build("a"))).not.toBe(chartSpecSignature(withOther));
  });

  it("legends the channel it is asked for, defaulting to colour", () => {
    const spec = compileChartSpec(
      <>
        <ChartColorLegend />
        <ChartColorLegend channel="symbol" />
      </>,
      context(),
    );
    const legends = spec.filter((d) => d.kind === "legend");
    expect(legends.map((d) => (d as { channel: string }).channel)).toEqual(["color", "symbol"]);
  });
});
