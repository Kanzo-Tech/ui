"use client";

import {
  ChartAxisX,
  ChartAxisY,
  ChartDot,
  ChartIntervalXY,
  ChartRoot,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// Two numeric columns and a 2-D brush. `ChartIntervalXY` publishes the dragged rectangle into the
// selection, so the same drag filters every other chart bound to it.

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot height={260} table="sightings">
          <ChartDot fill="var(--muted-foreground)" fillOpacity={0.25} filterBy={null} r={2} x="bounty" y="leagues" />
          <ChartDot fill="var(--primary)" r={2} x="bounty" y="leagues" />
          <ChartIntervalXY />
          <ChartAxisX label="bounty (gold)" />
          <ChartAxisY grid label="leagues from the road" />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
