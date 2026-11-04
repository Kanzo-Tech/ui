"use client";

import { median, quantile } from "@kanzo-tech/mosaic";
import {
  ChartAxisX,
  ChartAxisY,
  ChartBarX,
  ChartHighlight,
  ChartRoot,
  ChartRuleY,
  ChartTickX,
  ChartToggleY,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// Plot has no box-plot mark, and it does not need one: a box plot is three marks over four
// quantile aggregates. DuckDB computes them, so the whole distribution never leaves the database.

const p05 = quantile("bounty", 0.05);
const p25 = quantile("bounty", 0.25);
const p75 = quantile("bounty", 0.75);
const p95 = quantile("bounty", 0.95);
const p50 = median("bounty");

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot height={260} margin={{ top: 4, right: 16, bottom: 32, left: 88 }} relation="sightings">
          <ChartRuleY stroke="var(--muted-foreground)" x1={p05} x2={p95} y="region" />
          <ChartBarX
            fill="var(--chart-1)"
            fillOpacity={0.55}
            stroke="var(--chart-1)"
            x1={p25}
            x2={p75}
            y="region"
          />
          <ChartTickX stroke="var(--chart-1)" strokeWidth={2} x={p50} y="region" />
          <ChartToggleY />
          <ChartHighlight />
          <ChartAxisX grid label="bounty (gold)" />
          <ChartAxisY label={null} />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
