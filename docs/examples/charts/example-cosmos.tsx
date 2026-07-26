"use client";

import {
  ChartAxisX,
  ChartAxisY,
  ChartBarY,
  ChartBrushX,
  ChartLegend,
  ChartPickX,
  ChartRectY,
  ChartRoot,
  bin,
  categoricalColor,
  count,
  type ChartConfig,
} from "@kanzo-tech/ui/analytics";
import { CosmosGraph } from "./cosmos-graph";
import { GraphDemo } from "./graph-demo";

// The same two-way crossfilter as the Plot route, with a WebGL renderer where the scatter plot was.
//
//   lasso the graph  → `id IN (…)` → the histogram and the bars redraw
//   brush the weight → the graph greys out, without re-running the layout
//
// Nothing about the charts changed. They do not know a WebGL canvas joined the page, because what
// joined it is a `MosaicClient` — the same contract `ChartMenu` and `ChartSlider` implement.

const CLUSTERS: ChartConfig = {
  A: { label: "Cluster A", color: categoricalColor(0) },
  B: { label: "Cluster B", color: categoricalColor(1) },
  C: { label: "Cluster C", color: categoricalColor(2) },
};

const PALETTE = {
  A: categoricalColor(0),
  B: categoricalColor(1),
  C: categoricalColor(2),
};

export default function Example() {
  return (
    <GraphDemo prefix="cosmos" size={2000}>
      <div className="flex w-full flex-col gap-5">
        <CosmosGraph edges="cosmos_edge_pairs" palette={PALETTE} table="cosmos_nodes" />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <ChartRoot height={150} table="cosmos_nodes">
            <ChartRectY
              fill="var(--muted-foreground)"
              fillOpacity={0.28}
              filterBy={null}
              x={bin("weight")}
              y={count()}
            />
            <ChartRectY fill="var(--primary)" x={bin("weight")} y={count()} />
            <ChartBrushX />
            <ChartAxisX label="node weight — drag to grey out the graph" />
            <ChartAxisY grid label={null} />
          </ChartRoot>

          <ChartRoot config={CLUSTERS} height={150} table="cosmos_nodes">
            <ChartBarY
              fill="var(--muted-foreground)"
              fillOpacity={0.28}
              filterBy={null}
              x="category"
              y={count()}
              z={null}
            />
            <ChartBarY fill="category" tip x="category" y={count()} />
            <ChartPickX />
            <ChartAxisX label="cluster — click to isolate" />
            <ChartAxisY grid label={null} />
            <ChartLegend />
          </ChartRoot>
        </div>
      </div>
    </GraphDemo>
  );
}
