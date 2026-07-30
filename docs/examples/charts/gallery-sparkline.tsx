"use client";

import {
  ChartAreaY,
  ChartAxisX,
  ChartAxisY,
  ChartLineY,
  ChartRoot,
  avg,
  count,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// A sparkline is a plot with the furniture removed: `anchor={null}` drops each axis but keeps its
// scale, and `margin={0}` hands the whole box to the marks.

const SERIES = [
  { label: "Sightings", y: count(), color: "var(--chart-1)" },
  { label: "Mean bounty", y: avg("bounty"), color: "var(--chart-2)" },
  { label: "Leagues out", y: avg("leagues"), color: "var(--chart-3)" },
];

export default function Example() {
  return (
    <MosaicDemo>
      <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-3">
        {SERIES.map((series) => (
          <div className="flex flex-col gap-2 rounded-lg border bg-card p-3" key={series.label}>
            <p className="font-medium text-muted-foreground text-xs">{series.label}</p>
            <ChartRoot height={40} margin={0} table="sightings">
              <ChartAreaY fill={series.color} fillOpacity={0.16} x="hour" y={series.y} />
              <ChartLineY stroke={series.color} strokeWidth={1.5} x="hour" y={series.y} />
              <ChartAxisX anchor={null} label={null} />
              <ChartAxisY anchor={null} label={null} />
            </ChartRoot>
          </div>
        ))}
      </div>
    </MosaicDemo>
  );
}
