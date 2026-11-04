"use client";

import { count } from "@kanzo-tech/mosaic";
import {
  ChartAxisX,
  ChartAxisY,
  ChartHighlight,
  ChartLegend,
  ChartRoot,
  ChartToggleColor,
  ChartWaffleX,
  type ChartConfig,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// A bar chart that counts out loud: one cell per `unit` rows. Map `fill` to a column and the cells
// stack by series along each row, which is where a waffle beats a bar — parts of a whole.

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
        <ChartRoot config={config} height={260} margin={{ top: 4, right: 16, bottom: 32, left: 88 }} relation="sightings">
          <ChartWaffleX fill="verdict" order={ORDER} tip unit={5} x={count()} y="region" />
          <ChartToggleColor />
          <ChartHighlight />
          <ChartAxisX grid label="sightings (1 cell = 5)" />
          <ChartAxisY label={null} />
          <ChartLegend />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
