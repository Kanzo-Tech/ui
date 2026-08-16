"use client";

import { Show, Swatch } from "@kanzo-tech/ui";
import {
  ChartAxisX,
  ChartAxisY,
  ChartBarY,
  ChartHighlight,
  ChartPickX,
  ChartRoot,
  Query,
  count,
  useChartContext,
  useChartQuery,
  type ChartConfig,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "../charts/mosaic-demo";

const CONFIG: ChartConfig = {
  ok: { label: "OK", color: "var(--chart-1)" },
  slow: { label: "Slow", color: "var(--chart-3)" },
  error: { label: "Error", color: "var(--chart-5)" },
};

// A part of our own rather than a fork of `ChartLegend`, which is the whole point of the context:
// `color(key)` comes back already resolved against the live cascade — the literal printed beside
// each label is the string the plot itself was handed — and `formatNumber` is the root's own
// `Intl.NumberFormat`, so the caption counts in the same vocabulary as the axis.
function StatusKey() {
  const { color, config, formatNumber } = useChartContext();
  const { row } = useChartQuery({
    query: (filter) => Query.from("telemetry").select({ n: count() }).where(filter),
  });

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1">
        {Object.entries(config).map(([key, series]) => (
          <li className="flex items-center gap-2 text-xs" key={key}>
            <Swatch color={color(key) ?? "transparent"} />
            <span className="w-10">{series.label}</span>
            <code className="text-muted-foreground">{color(key)}</code>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs tabular-nums">
        <Show fallback={<>Counting…</>} when={row !== undefined}>
          {formatNumber(Number(row?.n ?? 0))} requests in view — click a bar to filter
        </Show>
      </p>
    </div>
  );
}

export default function Example() {
  return (
    <MosaicDemo>
      <div className="flex w-full max-w-md flex-col gap-3">
        <ChartRoot
          config={CONFIG}
          height={150}
          margin={{ top: 20, right: 8, bottom: 24, left: 40 }}
          numberFormat={{ maximumFractionDigits: 0 }}
          table="telemetry"
        >
          <ChartBarY fill="status" x="status" y={count()} />
          <ChartPickX />
          <ChartHighlight />
          <ChartAxisX label={null} />
          <ChartAxisY grid label="requests" />
          <StatusKey />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
