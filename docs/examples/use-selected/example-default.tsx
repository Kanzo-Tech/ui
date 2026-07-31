"use client";

import {
  ChartAxisX,
  ChartAxisY,
  ChartBarY,
  ChartHighlight,
  ChartIntervalX,
  ChartLineY,
  ChartRectY,
  ChartRoot,
  ChartToggleX,
  bin,
  count,
  useSelected,
} from "@kanzo-tech/ui/analytics";
import { FilterChips } from "@/lib/filter-chips";
import { MosaicDemo } from "../charts/mosaic-demo";

// `selected` is the page's read model: every clause any chart published, flattened into one plain
// union. That is what a chip row wants — it can report a filter it did not publish, from a plot it
// knows nothing about, because reading the union costs nothing and subscribing to three charts
// would cost a wiring diagram.
//
// Read model, not publish target. A chip's ✕ retracts the clause through its own source (see
// `docs/lib/filter-chips.tsx`), which is why removing one here also clears the brush that made it.

const MARGIN = { top: 4, right: 8, bottom: 34, left: 34 };

export default function Example() {
  return (
    <MosaicDemo>
      <Panel />
    </MosaicDemo>
  );
}

function Panel() {
  const selected = useSelected();

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <FilterChips
        className="flex min-h-6 flex-wrap items-center gap-1.5"
        empty="Nothing filtered yet — brush a chart or click a region."
        selection={selected}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <ChartRoot height={140} margin={MARGIN} table="telemetry">
          <ChartRectY fill="var(--muted-foreground)" filterBy={null} opacity={0.3} x={bin("latency")} y={count()} />
          <ChartRectY fill="var(--primary)" x={bin("latency")} y={count()} />
          <ChartIntervalX />
          <ChartAxisX label="latency (ms)" />
          <ChartAxisY label={null} />
        </ChartRoot>

        <ChartRoot height={140} margin={MARGIN} table="telemetry">
          <ChartBarY fill="var(--muted-foreground)" filterBy={null} opacity={0.3} x="region" y={count()} />
          <ChartBarY fill="var(--primary)" x="region" y={count()} />
          <ChartToggleX />
          <ChartHighlight />
          <ChartAxisX label="region" tickRotate={30} />
          <ChartAxisY label={null} />
        </ChartRoot>

        <ChartRoot height={140} margin={MARGIN} table="telemetry">
          <ChartLineY filterBy={null} stroke="var(--muted-foreground)" strokeOpacity={0.4} x="hour" y={count()} />
          <ChartLineY stroke="var(--primary)" x="hour" y={count()} />
          <ChartIntervalX />
          <ChartAxisX label="hour of day" ticks={8} />
          <ChartAxisY label={null} />
        </ChartRoot>
      </div>
    </div>
  );
}
