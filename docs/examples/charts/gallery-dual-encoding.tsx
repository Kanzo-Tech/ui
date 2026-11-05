"use client";

import { avg, count, sql, sum } from "@kanzo-tech/mosaic";
import {
  ChartAxisX,
  ChartAxisY,
  ChartBarY,
  ChartDot,
  ChartHighlight,
  ChartLegend,
  ChartLineY,
  ChartRoot,
  ChartToggleX,
  type ChartConfig,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// Three variables, one plot: bar height is the sighting count, bar opacity is the mean bounty, and
// the line is the failing subset — on the same count scale, because a plot has exactly one y.
//
// `ChartBarY` makes x a band scale even for an integer hour, so the interactor is a toggle: an
// interval brush over a band throws inside Mosaic's pre-aggregator.

const config = {
  sightings: { label: "Sightings (opacity = mean bounty)", color: "var(--chart-1)" },
  failing: { label: "Slow or failing", color: "var(--destructive)" },
} satisfies ChartConfig;

const failing = sum(sql`CASE WHEN verdict <> 'confirmed' THEN 1 ELSE 0 END`);

// `x` is a band scale here, and a band axis draws every value it has: `ticks={12}` would still draw
// 24 labels, which overlap on a phone. An explicit list is the thinning a band accepts.
const HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot height={260} relation="sightings">
          <ChartBarY fill="var(--chart-1)" fillOpacity={avg("bounty")} x="hour" y={count()} />
          <ChartToggleX />
          <ChartHighlight />
          <ChartLineY stroke="var(--destructive)" strokeWidth={2} x="hour" y={failing} />
          <ChartDot fill="var(--destructive)" r={2.5} x="hour" y={failing} />
          <ChartAxisX label="hour of day" ticks={HOURS} />
          <ChartAxisY grid label="sightings" />
          <ChartLegend config={config} />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
