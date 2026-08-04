"use client";

import {
  ChartAxisX,
  ChartAxisY,
  ChartBarY,
  ChartHighlight,
  ChartLegend,
  ChartLineY,
  ChartRoot,
  ChartToggleX,
  type ChartConfig,
  count,
  sql,
  sum,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// Bars and a line in the SAME plot — the thing five parallel preset components could not express.
// Two marks, one x scale, one interactor; the interactor binds to the last mark declared before it,
// so the toggle and the highlight sit between the bars and the line.
//
// The interactor is a toggle, not an interval brush: `ChartBarY` turns x into a band scale even for
// an integer hour, and an interval over a band throws inside Mosaic's pre-aggregator — which would
// blank every other chart on the page. `ChartRoot` warns about that pairing in development.
//
// Nothing here builds a `Selection`: `MosaicProvider` already owns the pair, so a bare
// `ChartToggleX` publishes somewhere a bare `ChartHighlight` can read it back.

const config = {
  sightings: { label: "Sightings", color: "var(--primary)" },
  failing: { label: "Slow or failing", color: "var(--destructive)" },
} satisfies ChartConfig;

const failing = sum(sql`CASE WHEN verdict <> 'confirmed' THEN 1 ELSE 0 END`);

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot height={240} table="sightings">
          <ChartBarY fill="var(--primary)" fillOpacity={0.85} x="hour" y={count()} />
          <ChartToggleX />
          <ChartHighlight />
          <ChartLineY stroke="var(--destructive)" strokeWidth={2} tip x="hour" y={failing} />
          <ChartAxisX label="hour of day" ticks={12} />
          <ChartAxisY grid label="sightings" />
          <ChartLegend config={config} />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
