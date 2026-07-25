"use client";

import {
  ChartAxisX,
  ChartAxisY,
  ChartBarY,
  ChartFacetX,
  ChartHighlight,
  ChartLegend,
  ChartRoot,
  ChartToggleColor,
  type ChartConfig,
  count,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// Grouped bars are faceted bars: `fx` splits the plot into one panel per region, `x` puts the
// series side by side inside each panel. The inner x axis is redundant with the legend, so it goes.

const config = {
  ok: { label: "OK", color: "var(--chart-2)" },
  slow: { label: "Slow", color: "var(--chart-4)" },
  error: { label: "Error", color: "var(--destructive)" },
} satisfies ChartConfig;

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot config={config} facetMargin={{ left: 8, right: 8 }} height={240} table="telemetry">
          <ChartBarY fill="status" fx="region" tip x="status" y={count()} />
          <ChartToggleColor />
          <ChartHighlight />
          <ChartAxisX anchor={null} label={null} />
          <ChartAxisY grid label="requests" />
          <ChartFacetX label={null} />
          <ChartLegend />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
