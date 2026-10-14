"use client";

import { count } from "@kanzo-tech/mosaic";
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
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// Grouped bars are faceted bars: `fx` splits the plot into one panel per region, `x` puts the
// series side by side inside each panel. The inner x axis is redundant with the legend, so it goes.

const config = {
  confirmed: { label: "Confirmed", color: "var(--chart-2)" },
  disputed: { label: "Disputed", color: "var(--chart-4)" },
  hoax: { label: "Hoax", color: "var(--destructive)" },
} satisfies ChartConfig;

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot config={config} facetMargin={{ left: 8, right: 8 }} height={240} relation="sightings">
          <ChartBarY fill="verdict" fx="region" tip x="verdict" y={count()} />
          <ChartToggleColor />
          <ChartHighlight />
          <ChartAxisX anchor={null} label={null} />
          <ChartAxisY grid label="sightings" />
          <ChartFacetX label={null} />
          <ChartLegend />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
