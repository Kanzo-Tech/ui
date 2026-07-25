"use client";

import {
  ChartAxisX,
  ChartAxisY,
  ChartIntervalX,
  ChartRectY,
  ChartRoot,
  bin,
  count,
} from "@kanzo-tech/ui/charts";
import { MosaicDemo } from "./mosaic-demo";

// Histogram: `bin()` on a numeric (or temporal) column, an interval brush, and the dual layer —
// the full distribution dimmed underneath (`filterBy={null}`), the crossfiltered subset on top.

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot height={220} table="telemetry">
          <ChartRectY fill="var(--muted-foreground)" filterBy={null} opacity={0.3} x={bin("latency")} y={count()} />
          <ChartRectY fill="var(--primary)" tip x={bin("latency")} y={count()} />
          <ChartIntervalX />
          <ChartAxisX label="latency (ms)" />
          <ChartAxisY grid label="requests" />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
