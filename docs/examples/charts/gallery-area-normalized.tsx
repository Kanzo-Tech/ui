"use client";

import {
  ChartAreaY,
  ChartAxisX,
  ChartAxisY,
  ChartLegend,
  ChartRoot,
  type ChartConfig,
  count,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// The stacked area, one prop later. `offset="normalize"` is Plot's stack option, passed straight
// through to the mark; `percent` on the y scale turns the 0–1 share into 0–100%.

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
          <ChartAreaY
            curve="monotone-x"
            fill="verdict"
            offset="normalize"
            order={ORDER}
            tip
            x="hour"
            y={count()}
          />
          <ChartAxisX label="hour of day" ticks={12} />
          <ChartAxisY grid label="share of sightings" percent />
          <ChartLegend />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
