"use client";

import {
  ChartAxisX,
  ChartAxisY,
  ChartHighlight,
  ChartLegend,
  ChartRoot,
  ChartToggleColor,
  ChartWaffleY,
  type ChartConfig,
  count,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// A bar chart that counts out loud: one cell per `unit` rows. Map `fill` to a column and the cells
// stack by series inside each column, which is where a waffle beats a bar — parts of a whole.

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
        <ChartRoot config={config} height={260} table="sightings">
          <ChartWaffleY fill="verdict" order={ORDER} tip unit={5} x="region" y={count()} />
          <ChartToggleColor />
          <ChartHighlight />
          <ChartAxisX label={null} />
          <ChartAxisY grid label="sightings (1 cell = 5)" />
          <ChartLegend />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
