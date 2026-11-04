"use client";

import { count } from "@kanzo-tech/mosaic";
import {
  ChartAxisX,
  ChartAxisY,
  ChartBarX,
  ChartHighlight,
  ChartLegend,
  ChartRoot,
  ChartToggleColor,
  type ChartConfig,
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

const MARGIN = { top: 4, right: 16, bottom: 32, left: 88 };

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot config={config} height={240} margin={MARGIN} relation="sightings">
          <ChartBarX fill="verdict" order={ORDER} tip x={count()} y="region" />
          <ChartToggleColor />
          <ChartHighlight />
          <ChartAxisX grid label="sightings" />
          <ChartAxisY label={null} />
          <ChartLegend />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
