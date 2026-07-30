"use client";

import { Show } from "@kanzo-tech/ui";
import {
  ChartAxisX,
  ChartAxisY,
  ChartBarX,
  ChartHighlight,
  ChartPickY,
  ChartRoot,
  Query,
  avg,
  count,
  useChartQuery,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "../charts/mosaic-demo";

// Two readings of the same relation: one under the crossfilter, one deliberately outside it
// (`filterBy={null}`) so the pair reads as "N of M". Click a region bar and only the first moves.
//
// The hook is a `MosaicClient` connected to the coordinator, not a query in an effect — a widget
// that takes the shortcut sits there reporting unfiltered totals beside filtered charts, which
// nobody reads as a stale widget.
function Readout() {
  const shown = useChartQuery({
    query: (filter) =>
      Query.from("telemetry").select({ n: count(), ms: avg("latency") }).where(filter),
  });
  const all = useChartQuery({
    filterBy: null,
    query: () => Query.from("telemetry").select({ n: count() }),
  });

  return (
    <p className="text-muted-foreground text-sm tabular-nums">
      <Show fallback={<>Counting…</>} when={shown.row !== undefined && all.row !== undefined}>
        <span className="font-medium text-foreground">
          {Number(shown.row?.n ?? 0).toLocaleString()}
        </span>{" "}
        of {Number(all.row?.n ?? 0).toLocaleString()} requests · mean{" "}
        {Math.round(Number(shown.row?.ms ?? 0))} ms
      </Show>
    </p>
  );
}

export default function Example() {
  return (
    <MosaicDemo>
      <div className="flex w-full max-w-md flex-col gap-3">
        <Readout />
        <ChartRoot
          height={140}
          margin={{ top: 4, right: 12, bottom: 28, left: 76 }}
          table="telemetry"
        >
          <ChartBarX fill="var(--primary)" sort={{ y: "-x" }} tip x={count()} y="region" />
          <ChartPickY />
          <ChartHighlight />
          <ChartAxisX grid label="requests" />
          <ChartAxisY label={null} />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
