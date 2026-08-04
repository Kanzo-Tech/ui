"use client";

import {
  ChartAxisX,
  ChartAxisY,
  ChartCell,
  ChartRoot,
  count,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// Two categorical axes and a measure in the cell. The magnitude rides on `fillOpacity` rather than
// on a colour ramp, so the hue stays a token and the grid re-skins with the theme.

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot
          height={180}
          margin={{ top: 4, right: 16, bottom: 32, left: 76 }}
          table="sightings"
        >
          <ChartCell
            fill="var(--chart-1)"
            fillOpacity={count()}
            inset={0.5}
            tip
            x="hour"
            y="region"
          />
          <ChartAxisX label="hour of day" ticks={12} />
          <ChartAxisY label={null} />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
