"use client";

import {
  ChartAxisX,
  ChartAxisY,
  ChartContour,
  ChartDot,
  ChartRoot,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// The kernel density of a pair of columns, drawn as iso-lines over the raw points. The smoothing
// happens in DuckDB — `bandwidth` and `thresholds` are the two knobs worth touching.

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot height={280} table="sightings">
          <ChartDot fill="var(--muted-foreground)" fillOpacity={0.2} r={1.5} x="bounty" y="leagues" />
          <ChartContour
            bandwidth={22}
            stroke="var(--chart-1)"
            strokeWidth={1.25}
            thresholds={8}
            x="bounty"
            y="leagues"
          />
          <ChartAxisX label="bounty (gold)" />
          <ChartAxisY grid label="leagues from the road" />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
