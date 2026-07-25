"use client";

import {
  ChartAxisX,
  ChartAxisY,
  ChartBarY,
  ChartHighlight,
  ChartRoot,
  ChartRuleX,
  ChartTickY,
  ChartToggleX,
  median,
  quantile,
} from "@kanzo-tech/ui/charts";
import { MosaicDemo } from "./mosaic-demo";

// Plot has no box-plot mark, and it does not need one: a box plot is three marks over four
// quantile aggregates. DuckDB computes them, so the whole distribution never leaves the database.

const p05 = quantile("latency", 0.05);
const p25 = quantile("latency", 0.25);
const p75 = quantile("latency", 0.75);
const p95 = quantile("latency", 0.95);
const p50 = median("latency");

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot height={260} table="telemetry">
          <ChartRuleX stroke="var(--muted-foreground)" x="region" y1={p05} y2={p95} />
          <ChartBarY
            fill="var(--chart-1)"
            fillOpacity={0.55}
            stroke="var(--chart-1)"
            x="region"
            y1={p25}
            y2={p75}
          />
          <ChartTickY stroke="var(--chart-1)" strokeWidth={2} x="region" y={p50} />
          <ChartToggleX />
          <ChartHighlight />
          <ChartAxisX label={null} />
          <ChartAxisY grid label="latency (ms)" />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
