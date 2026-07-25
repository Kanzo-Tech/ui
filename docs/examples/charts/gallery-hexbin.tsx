"use client";

import {
  ChartAxisX,
  ChartAxisY,
  ChartHexbin,
  ChartHexgrid,
  ChartIntervalXY,
  ChartRoot,
  count,
} from "@kanzo-tech/ui/charts";
import { MosaicDemo } from "./mosaic-demo";

// A scatter that does not overplot: DuckDB bins the pairs into hexagons and returns one row per
// bin. `ChartHexgrid` is a decorator, so it draws the empty lattice behind the data.

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot height={280} table="telemetry">
          <ChartHexgrid strokeOpacity={0.12} />
          <ChartHexbin
            binWidth={18}
            fill="var(--chart-1)"
            fillOpacity={count()}
            tip
            x="latency"
            y="payload"
          />
          <ChartIntervalXY />
          <ChartAxisX label="latency (ms)" />
          <ChartAxisY label="payload (kB)" />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
