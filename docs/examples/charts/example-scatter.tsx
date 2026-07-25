"use client";

import {
  ChartAxisX,
  ChartAxisY,
  ChartDot,
  ChartIntervalXY,
  ChartRoot,
} from "@kanzo-tech/ui/charts";
import { MosaicDemo } from "./mosaic-demo";

// Two numeric columns and a 2-D brush. `ChartIntervalXY` publishes the dragged rectangle into the
// selection, so the same drag filters every other chart bound to it.

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot height={260} table="telemetry">
          <ChartDot fill="var(--muted-foreground)" fillOpacity={0.25} filterBy={null} r={2} x="latency" y="payload" />
          <ChartDot fill="var(--primary)" r={2} x="latency" y="payload" />
          <ChartIntervalXY />
          <ChartAxisX label="latency (ms)" />
          <ChartAxisY grid label="payload (kB)" />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
