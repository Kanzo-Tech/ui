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
        <ChartRoot height={280} table="telemetry">
          <ChartDot fill="var(--muted-foreground)" fillOpacity={0.2} r={1.5} x="latency" y="payload" />
          <ChartContour
            bandwidth={22}
            stroke="var(--chart-1)"
            strokeWidth={1.25}
            thresholds={8}
            x="latency"
            y="payload"
          />
          <ChartAxisX label="latency (ms)" />
          <ChartAxisY grid label="payload (kB)" />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
