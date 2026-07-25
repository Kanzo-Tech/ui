"use client";

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
  avg,
  count,
  sql,
  sum,
} from "@kanzo-tech/ui/charts";
import { MosaicDemo } from "./mosaic-demo";

// Three variables, one plot: bar height is the request count, bar opacity is the mean latency, and
// the line is the failing subset — on the same count scale, because a plot has exactly one y.
//
// `ChartBarY` makes x a band scale even for an integer hour, so the interactor is a toggle: an
// interval brush over a band throws inside Mosaic's pre-aggregator.

const config = {
  requests: { label: "Requests (opacity = mean latency)", color: "var(--chart-1)" },
  failing: { label: "Slow or failing", color: "var(--destructive)" },
} satisfies ChartConfig;

const failing = sum(sql`CASE WHEN status <> 'ok' THEN 1 ELSE 0 END`);

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot height={260} table="telemetry">
          <ChartBarY fill="var(--chart-1)" fillOpacity={avg("latency")} tip x="hour" y={count()} />
          <ChartToggleX />
          <ChartHighlight />
          <ChartLineY stroke="var(--destructive)" strokeWidth={2} x="hour" y={failing} />
          <ChartDot fill="var(--destructive)" r={2.5} x="hour" y={failing} />
          <ChartAxisX label="hour of day" ticks={12} />
          <ChartAxisY grid label="requests" />
          <ChartLegend config={config} />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
