"use client";

import {
  ChartAxisX,
  ChartAxisY,
  ChartDot,
  ChartRegressionY,
  ChartRoot,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// The fit is a SQL aggregate: DuckDB returns the slope, the intercept and the sums of squares, and
// the mark turns them into a line plus its confidence band. `ci` is the level; `ci={0}` drops it.

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot height={280} table="telemetry">
          <ChartDot fill="var(--muted-foreground)" fillOpacity={0.25} r={2} x="latency" y="payload" />
          <ChartRegressionY ci={0.95} stroke="var(--chart-1)" x="latency" y="payload" />
          <ChartAxisX label="latency (ms)" />
          <ChartAxisY grid label="payload (kB)" />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
