"use client";

import {
  ChartAreaY,
  ChartAxisX,
  ChartAxisY,
  ChartFacetX,
  ChartIntervalX,
  ChartLineY,
  ChartRoot,
  count,
} from "@kanzo-tech/ui/charts";
import { MosaicDemo } from "./mosaic-demo";

// `fx` on a mark is all a small multiple is: one panel per distinct value, one shared pair of
// scales, so the four curves are actually comparable. The brush spans the panels.

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-2xl">
        <ChartRoot facetMargin={{ left: 6, right: 6 }} height={200} table="telemetry">
          <ChartAreaY fill="var(--chart-1)" fillOpacity={0.15} fx="region" x="hour" y={count()} />
          <ChartLineY fx="region" stroke="var(--chart-1)" strokeWidth={1.5} x="hour" y={count()} />
          <ChartIntervalX />
          <ChartAxisX label={null} ticks={4} />
          <ChartAxisY grid label="requests" />
          <ChartFacetX label={null} />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
