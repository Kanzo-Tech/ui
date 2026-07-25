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
  ok: { label: "OK", color: "var(--chart-2)" },
  slow: { label: "Slow", color: "var(--chart-4)" },
  error: { label: "Error", color: "var(--destructive)" },
} satisfies ChartConfig;

const ORDER = ["ok", "slow", "error"];

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot config={config} height={260} table="telemetry">
          <ChartWaffleY fill="status" order={ORDER} tip unit={5} x="region" y={count()} />
          <ChartToggleColor />
          <ChartHighlight />
          <ChartAxisX label={null} />
          <ChartAxisY grid label="requests (1 cell = 5)" />
          <ChartLegend />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
