"use client";

import { Badge, Show, Swatch } from "@kanzo-tech/ui";
import {
  ChartAxisX,
  ChartAxisY,
  ChartBarY,
  ChartRoot,
  categoricalColor,
  chartSeriesEntries,
  count,
  useChartOptional,
  type ChartConfig,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "../charts/mosaic-demo";

const CONFIG: ChartConfig = {
  ok: { label: "OK", color: "var(--chart-1)" },
  slow: { label: "Slow", color: "var(--chart-3)" },
  error: { label: "Error", color: "var(--chart-5)" },
};

const STANDALONE = ["Draft", "In review", "Shipped"];

/**
 * One key, two homes. Inside a `ChartRoot` it inherits the root's config, so the swatches match
 * the marks by construction; outside one it falls back to its own props instead of throwing —
 * which is exactly how `ChartLegend` doubles as a standalone key.
 */
function SeriesKey({ series }: { series?: readonly string[] }) {
  const chart = useChartOptional();
  const config =
    chart?.config ??
    Object.fromEntries(
      (series ?? []).map((label, i) => [label, { color: categoricalColor(i) }]),
    );

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Badge size="sm" variant="outline">
        <Show fallback={<>standalone</>} when={chart !== null}>
          in a ChartRoot
        </Show>
      </Badge>
      {chartSeriesEntries(config).map(({ key, label, color }) => (
        <span className="flex items-center gap-1.5 text-muted-foreground text-xs" key={key}>
          <Swatch color={color} size="xs" />
          {label}
        </span>
      ))}
    </div>
  );
}

export default function Example() {
  return (
    <MosaicDemo>
      <div className="flex w-full max-w-md flex-col gap-4">
        <ChartRoot
          config={CONFIG}
          height={130}
          margin={{ top: 4, right: 8, bottom: 24, left: 40 }}
          table="telemetry"
        >
          <ChartBarY fill="status" x="status" y={count()} />
          <ChartAxisX label={null} />
          <ChartAxisY grid label={null} />
          <SeriesKey />
        </ChartRoot>

        <SeriesKey series={STANDALONE} />
      </div>
    </MosaicDemo>
  );
}
