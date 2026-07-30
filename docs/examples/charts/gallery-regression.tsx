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
        <ChartRoot height={280} table="sightings">
          <ChartDot fill="var(--muted-foreground)" fillOpacity={0.25} r={2} x="bounty" y="leagues" />
          <ChartRegressionY ci={0.95} stroke="var(--chart-1)" x="bounty" y="leagues" />
          <ChartAxisX label="bounty (gold)" />
          <ChartAxisY grid label="leagues from the road" />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
