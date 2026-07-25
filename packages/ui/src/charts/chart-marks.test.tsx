import { describe, expect, it } from "vitest";
import type { Selection } from "@uwdata/mosaic-core";
import * as vg from "@uwdata/vgplot";
import * as markModule from "./chart-marks.js";
import { compileChartSpec, type ChartDescriptor, type ChartMarkDirective, type ChartSpecContext } from "./chart-spec.js";

/**
 * The mark vocabulary as a set. Individual mark semantics live in `chart-spec.test.tsx`; what is
 * checked here is that every wrapper names a directive vgplot actually exports, and that the
 * data/decorator split matches vgplot's own.
 */

const shared = { id: "shared" } as unknown as Selection;

const context = (over: Partial<ChartSpecContext> = {}): ChartSpecContext => ({
  table: "telemetry",
  filterBy: shared,
  as: shared,
  config: {},
  resolveColor: (token) => `rgb(${token})`,
  ...over,
});

const isDescriptor = (value: unknown): value is ChartDescriptor<Record<string, unknown>> =>
  typeof value === "function" && typeof (value as { __chart?: unknown }).__chart === "function";

/** Every exported descriptor, compiled with empty props, keeping the ones that are marks. */
const wrapped: { name: string; directive: ChartMarkDirective }[] = Object.entries(
  markModule as Record<string, unknown>,
)
  .filter((entry): entry is [string, ChartDescriptor<Record<string, unknown>>] => isDescriptor(entry[1]))
  .flatMap(([name, descriptor]) => {
    const produced = descriptor.__chart({}, context());
    return (Array.isArray(produced) ? produced : [produced])
      .filter((d): d is ChartMarkDirective => d.kind === "mark")
      .map((directive) => ({ name, directive }));
  });

const directives = vg as unknown as Record<string, unknown>;

describe("mark vocabulary", () => {
  it("names a directive vgplot exports, for every wrapper", () => {
    const missing = wrapped.filter(({ directive }) => typeof directives[directive.mark] !== "function");
    expect(missing.map((m) => `${m.name} → ${m.directive.mark}`)).toEqual([]);
    // Cheap guard against the whole list silently disappearing behind a bad filter.
    expect(wrapped.length).toBeGreaterThan(40);
  });

  it("gives every mark a distinct vgplot directive", () => {
    const names = wrapped.map((m) => m.directive.mark);
    expect(new Set(names).size).toBe(names.length);
  });

  it("takes data for a data mark and none for a decorator", () => {
    const decorators = wrapped.filter(({ directive }) => directive.source === null).map((m) => m.name);
    expect(decorators.sort()).toEqual([
      "ChartFrame",
      "ChartGraticule",
      "ChartGridX",
      "ChartGridY",
      "ChartHexgrid",
      "ChartSphere",
    ]);
    expect(wrapped.find((m) => m.name === "ChartWaffleY")?.directive.source).toEqual({
      kind: "table",
      table: "telemetry",
      filterBy: shared,
    });
  });

  it("compiles the new marks with the same sugar as the old ones", () => {
    const spec = compileChartSpec(
      <>
        <markModule.ChartWaffleY x="host" y="n" fill="var(--chart-1)" />
        <markModule.ChartSpike data={[{ x: 1 }]} length="n" />
        <markModule.ChartHexgrid stroke="--border" />
      </>,
      context(),
    );

    expect(spec).toMatchObject([
      { mark: "waffleY", source: { kind: "table" }, options: { x: "host", y: "n", fill: "rgb(var(--chart-1))" } },
      { mark: "spike", source: { kind: "values", values: [{ x: 1 }] }, options: { length: "n" } },
      { mark: "hexgrid", source: null, options: { stroke: "rgb(--border)" } },
    ]);
  });
});

describe("stacking series key", () => {
  const optionsOf = (node: Parameters<typeof compileChartSpec>[0]) => {
    const [directive] = compileChartSpec(node, context()) as ChartMarkDirective[];
    return directive!.options as Record<string, unknown>;
  };

  it("defaults `z` to a column-valued fill on a stacking mark", () => {
    expect(optionsOf(<markModule.ChartBarY fill="status" x="region" />).z).toBe("status");
    expect(optionsOf(<markModule.ChartAreaY fill="status" x="ts" />).z).toBe("status");
  });

  it("leaves a caller's `z` alone, including an explicit null", () => {
    expect(optionsOf(<markModule.ChartBarY fill="status" z="host" />).z).toBe("host");
    expect(optionsOf(<markModule.ChartBarY fill="status" z={null} />).z).toBeNull();
  });

  it("does not mistake a colour for a series, in any of its spellings", () => {
    // Reading a colour as a column made the query GROUP BY it, which is a binder error the plot
    // swallows — it just stops updating. Found by a node-link probe passing `currentColor`.
    for (const fill of ["var(--chart-1)", "currentColor", "#ff0000", "rgb(1,2,3)", "none", "red"]) {
      expect(optionsOf(<markModule.ChartBarY fill={fill} x="region" />).z).toBeUndefined();
    }
  });

  it("leaves non-stacking marks untouched", () => {
    expect(optionsOf(<markModule.ChartDot fill="status" x="a" y="b" />).z).toBeUndefined();
    expect(optionsOf(<markModule.ChartLineY stroke="host" x="ts" />).z).toBeUndefined();
  });
});

describe("per-mark relation", () => {
  const optionsOf = (node: Parameters<typeof compileChartSpec>[0]) =>
    (compileChartSpec(node, context()) as ChartMarkDirective[])[0]!;

  it("lets a mark read a relation other than the root's, keeping the shared filter", () => {
    const d = optionsOf(<markModule.ChartLink table="graph_edges" x1="x" y1="y" x2="x2" y2="y2" />);
    expect(d.source).toEqual({ kind: "table", table: "graph_edges", filterBy: shared });
    // `table` chooses the source; it is never a mark option.
    expect(d.options.table).toBeUndefined();
  });

  it("falls back to the root's table", () => {
    expect(optionsOf(<markModule.ChartDot x="a" y="b" />).source).toEqual({
      kind: "table", table: "telemetry", filterBy: shared,
    });
  });
});
