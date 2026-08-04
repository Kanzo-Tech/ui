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
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// The histogram, split by a series. `bin()` keeps the x scale continuous, which is what makes the
// interval brush legal — the same chart with `x="region"` would be a band scale and would throw.

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
          <ChartRectY fill="verdict" order={ORDER} tip x={bin("bounty")} y={count()} />
          <ChartIntervalX />
          <ChartAxisX label="bounty (gold)" />
          <ChartAxisY grid label="sightings" />
          <ChartLegend />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
