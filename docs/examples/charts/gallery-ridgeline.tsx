"use client";

import { yRange } from "@uwdata/vgplot";
import {
  ChartAreaY,
  ChartAxisX,
  ChartAxisY,
  ChartFacetY,
  ChartLineY,
  ChartRoot,
  bin,
  count,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// One distribution per row, panels overlapping. `fy` makes the rows; the overlap is the y scale's
// *range* overshooting its band — an attribute `ChartAxisY` does not wrap, so it goes through
// `attributes`. Everything else is a binned area with a hairline on top.

// The y range is in pixels and it is deliberately taller than a facet band (50px here): the ridge
// stands on its own row's label and reaches into the row above.
const OVERLAP = [yRange([72, -18])];

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot
          attributes={OVERLAP}
          height={280}
          margin={{ top: 48, right: 16, bottom: 32, left: 76 }}
          table="telemetry"
        >
          <ChartAreaY
            curve="basis"
            fill="var(--chart-1)"
            fillOpacity={0.65}
            fy="region"
            x={bin("latency", { steps: 40 })}
            y={count()}
          />
          <ChartLineY
            curve="basis"
            fy="region"
            stroke="var(--background)"
            strokeWidth={1}
            x={bin("latency", { steps: 40 })}
            y={count()}
          />
          <ChartAxisX label="latency (ms)" />
          <ChartAxisY anchor={null} label={null} />
          <ChartFacetY label={null} />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
