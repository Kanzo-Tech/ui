"use client";

import {
  ChartAreaY,
  ChartAxisX,
  ChartAxisY,
  ChartIntervalX,
  ChartLegend,
  ChartRoot,
  type ChartConfig,
  count,
} from "@kanzo-tech/ui/charts";
import { MosaicDemo } from "./mosaic-demo";

// Map `fill` to a column and the areas stack by it: the layer copies a column-valued `fill` to `z`,
// which is the series key Plot stacks on. `order` is still yours — see the note below the chart.
// The x scale is continuous, so a brush is legal here.

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
          <ChartAreaY curve="monotone-x" fill="status" order={ORDER} tip x="hour" y={count()} />
          <ChartIntervalX />
          <ChartAxisX label="hour of day" ticks={12} />
          <ChartAxisY grid label="requests" />
          <ChartLegend />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
