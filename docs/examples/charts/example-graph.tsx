"use client";

import { useMemo } from "react";
import { from, link } from "@uwdata/vgplot";
import {
  ChartAxisX,
  ChartAxisY,
  ChartBarY,
  ChartBrushX,
  ChartDot,
  ChartHighlight,
  ChartLegend,
  ChartPickX,
  ChartRaw,
  ChartRectY,
  ChartRegion,
  ChartRoot,
  bin,
  categoricalColor,
  count,
  useCrossfilter,
  type ChartConfig,
} from "@kanzo-tech/ui/analytics";
import { GraphDemo } from "./graph-demo";

// A node-link view with no node-link component in it.
//
// The layout is computed once and stored as `x` / `y` columns, so the graph is a scatter plot of
// `graph_nodes` with a `link` mark of `graph_edges` under it. Because both relations are ordinary
// tables in the same coordinator, the crossfilter is the one every other chart already uses:
//
//   lasso the graph → `id IN (…)` → the histogram and the bars redraw
//   brush the histogram → `weight BETWEEN … AND …` → nodes *and* edges drop out of the graph
//
// The edge relation carries its **source** node's columns under the node table's own names, which
// is what lets a clause written for nodes land on edges untranslated. An edge therefore survives a
// filter when its source does; a both-endpoints rule would need a second predicate, and a single
// shared clause cannot express one.

const CLUSTERS: ChartConfig = {
  A: { label: "Cluster A", color: categoricalColor(0) },
  B: { label: "Cluster B", color: categoricalColor(1) },
  C: { label: "Cluster C", color: categoricalColor(2) },
};

const EDGE = { x1: "x", y1: "y", x2: "x2", y2: "y2", stroke: "currentColor" } as const;

export default function Example() {
  return (
    <GraphDemo size={220}>
      <GraphCrossfilter />
    </GraphDemo>
  );
}

function GraphCrossfilter() {
  const crossfilter = useCrossfilter();
  // The layer wraps `link` as `<ChartLink>`, but a mark reads `ChartRoot`'s single `table` and the
  // edges live in a second relation — so the second relation goes through the raw escape hatch.
  // Memoised: a fresh directive on every render would rebuild the whole plot.
  const ghostEdges = useMemo(
    () => link(from("graph_edges"), { ...EDGE, strokeOpacity: 0.1, strokeWidth: 0.5 }),
    [],
  );
  const liveEdges = useMemo(
    () => link(from("graph_edges", { filterBy: crossfilter }), { ...EDGE, strokeOpacity: 0.35, strokeWidth: 0.6 }),
    [crossfilter],
  );

  return (
    <div className="flex w-full flex-col gap-5">
      <ChartRoot config={CLUSTERS} height={420} margin={8} table="graph_nodes">
        <ChartRaw spec={ghostEdges} />
        <ChartRaw spec={liveEdges} />
        <ChartHighlight strokeOpacity={0.06} />
        <ChartDot fill="currentColor" fillOpacity={0.12} filterBy={null} r={2.2} x="x" y="y" />
        <ChartDot
          channels={{ id: "id", category: "category", degree: "degree" }}
          fill="category"
          r={3.2}
          stroke="var(--background)"
          strokeWidth={0.6}
          tip
          x="x"
          y="y"
        />
        <ChartRegion channels={["id"]} />
        <ChartHighlight fillOpacity={0.1} />
        <ChartAxisX anchor={null} domain={[0, 1]} label={null} />
        <ChartAxisY anchor={null} domain={[0, 1]} label={null} />
        <ChartLegend />
      </ChartRoot>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <ChartRoot height={150} table="graph_nodes">
          <ChartRectY fill="var(--muted-foreground)" fillOpacity={0.28} filterBy={null} x={bin("weight")} y={count()} />
          <ChartRectY fill="var(--primary)" x={bin("weight")} y={count()} />
          <ChartBrushX />
          <ChartAxisX label="node weight — drag to reduce the graph" />
          <ChartAxisY grid label={null} />
        </ChartRoot>

        {/* Ghost layer instead of `ChartHighlight`: Mosaic evaluates a highlight predicate as an
            extra select on the mark's own grouped query, and a clause over a column the bars do
            not group by (`weight`) makes that query illegal. The dimmed full relation says the
            same thing without a second query. */}
        <ChartRoot config={CLUSTERS} height={150} table="graph_nodes">
          <ChartBarY fill="var(--muted-foreground)" fillOpacity={0.28} filterBy={null} x="category" y={count()} z={null} />
          <ChartBarY fill="category" tip x="category" y={count()} />
          <ChartPickX />
          <ChartAxisX label="cluster — click to isolate" />
          <ChartAxisY grid label={null} />
        </ChartRoot>
      </div>
    </div>
  );
}
