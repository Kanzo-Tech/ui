"use client";

import {
  ChartAreaY,
  ChartAxisX,
  ChartAxisY,
  ChartIntervalX,
  ChartLineY,
  ChartRoot,
  count,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// A count over an ordered axis. A line is stroked rather than filled, so the token lands on
// `stroke`; the area under it is a second mark, which is all "line + area" ever was.

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot height={220} table="telemetry">
          <ChartAreaY fill="var(--primary)" fillOpacity={0.12} x="hour" y={count()} />
          <ChartLineY filterBy={null} stroke="var(--muted-foreground)" strokeOpacity={0.4} x="hour" y={count()} />
          <ChartLineY stroke="var(--primary)" strokeWidth={2} tip x="hour" y={count()} />
          <ChartIntervalX />
          <ChartAxisX label="hour of day" ticks={12} />
          <ChartAxisY grid label="requests" />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
