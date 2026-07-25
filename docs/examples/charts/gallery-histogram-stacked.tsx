"use client";

import {
  ChartAxisX,
  ChartAxisY,
  ChartIntervalX,
  ChartLegend,
  ChartRectY,
  ChartRoot,
  type ChartConfig,
  bin,
  count,
} from "@kanzo-tech/ui/charts";
import { MosaicDemo } from "./mosaic-demo";

// The histogram, split by a series. `bin()` keeps the x scale continuous, which is what makes the
// interval brush legal — the same chart with `x="region"` would be a band scale and would throw.

const config = {
  ok: { label: "OK", color: "var(--chart-2)" },
  slow: { label: "Slow", color: "var(--chart-4)" },
  error: { label: "Error", color: "var(--destructive)" },
} satisfies ChartConfig;

const ORDER = ["ok", "slow", "error"];

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot config={config} height={240} table="telemetry">
          <ChartRectY fill="status" order={ORDER} tip x={bin("latency")} y={count()} />
          <ChartIntervalX />
          <ChartAxisX label="latency (ms)" />
          <ChartAxisY grid label="requests" />
          <ChartLegend />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
