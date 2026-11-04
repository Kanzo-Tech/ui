"use client";

import { count } from "@kanzo-tech/mosaic";
import {
  ChartAxisX,
  ChartAxisY,
  ChartBarX,
  ChartFacetY,
  ChartHighlight,
  ChartLegend,
  ChartRoot,
  ChartToggleColor,
  type ChartConfig,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// Grouped bars are faceted bars: `fy` splits the plot into one row per region, `y` puts the series
// side by side inside each row. The inner y axis is redundant with the legend, so it goes.

const config = {
  confirmed: { label: "Confirmed", color: "var(--chart-2)" },
  disputed: { label: "Disputed", color: "var(--chart-4)" },
  hoax: { label: "Hoax", color: "var(--destructive)" },
} satisfies ChartConfig;

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot
          config={config}
          facetMargin={{ top: 4, bottom: 4 }}
          height={300}
          margin={{ top: 4, right: 16, bottom: 32, left: 96 }}
          relation="sightings"
        >
          <ChartBarX fill="verdict" fy="region" tip x={count()} y="verdict" />
          <ChartToggleColor />
          <ChartHighlight />
          <ChartAxisX grid label="sightings" />
          <ChartAxisY anchor={null} label={null} />
          <ChartFacetY anchor="left" label={null} />
          <ChartLegend />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
