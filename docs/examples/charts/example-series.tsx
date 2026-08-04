"use client";

import {
  ChartAxisX,
  ChartAxisY,
  ChartBarY,
  ChartHighlight,
  ChartLegend,
  ChartRoot,
  ChartToggleColor,
  type ChartConfig,
  count,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// Stacked bars by a series column. A column-valued `fill` is also the stacking key: the layer
// copies it to `z`, because through Mosaic the fill reaches Plot as `{ value, scale: "color" }` and
// Plot cannot read a series out of that — without `z` it stacks every row on the previous one.
//
// The config is what binds a hue to an entity: it pins the plot's colour domain, so filtering a
// series never repaints the survivors, and it is the same object `ChartLegend` reads.

const config = {
  confirmed: { label: "Confirmed", color: "var(--chart-2)" },
  disputed: { label: "Disputed", color: "var(--chart-4)" },
  hoax: { label: "Hoax", color: "var(--destructive)" },
} satisfies ChartConfig;

const ORDER = ["confirmed", "disputed", "hoax"];

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot config={config} height={240} table="sightings">
          <ChartBarY fill="verdict" order={ORDER} tip x="region" y={count()} />
          <ChartToggleColor />
          <ChartHighlight />
          <ChartAxisX label={null} />
          <ChartAxisY grid label="sightings" />
          <ChartLegend />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
