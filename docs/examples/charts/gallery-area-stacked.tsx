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
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// Map `fill` to a column and the areas stack by it: the layer copies a column-valued `fill` to `z`,
// which is the series key Plot stacks on. `order` is still yours — see the note below the chart.
// The x scale is continuous, so a brush is legal here.

const config = {
  confirmed: { label: "Confirmed", color: "var(--chart-2)" },
  disputed: { label: "Disputed", color: "var(--chart-4)" },
  hoax: { label: "Hoax", color: "var(--destructive)" },
} satisfies ChartConfig;

const ORDER = ["confirmed", "disputed", "hoax"];

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot config={config} height={240} table="sightings">
          <ChartAreaY curve="monotone-x" fill="verdict" order={ORDER} tip x="hour" y={count()} />
          <ChartIntervalX />
          <ChartAxisX label="hour of day" ticks={12} />
          <ChartAxisY grid label="sightings" />
          <ChartLegend />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
