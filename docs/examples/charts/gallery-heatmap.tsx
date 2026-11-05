"use client";

import { count } from "@kanzo-tech/mosaic";
import { ChartAxisX, ChartAxisY, ChartCell, ChartRoot } from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// Two categorical axes and a measure in the cell. The magnitude rides on `fillOpacity` rather than
// on a colour ramp, so the hue stays a token and the grid re-skins with the theme.

// `x` is a band scale here, and a band axis draws every value it has: `ticks={12}` would still draw
// 24 labels, which overlap on a phone. An explicit list is the thinning a band accepts.
const HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot
          height={180}
          margin={{ top: 4, right: 16, bottom: 32, left: 76 }}
          relation="sightings"
        >
          <ChartCell
            fill="var(--chart-1)"
            fillOpacity={count()}
            inset={0.5}
            tip
            x="hour"
            y="region"
          />
          <ChartAxisX label="hour of day" ticks={HOURS} />
          <ChartAxisY label={null} />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
