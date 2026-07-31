"use client";

import { StatTile } from "@kanzo-tech/ui";
import {
  ChartAxisX,
  ChartAxisY,
  ChartIntervalX,
  ChartRectY,
  ChartRoot,
  Query,
  bin,
  count,
  useChartQuery,
  useCrossfilter,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "../charts/mosaic-demo";

// The crossfilter is what marks filter *by* — and handing it to something that is not a mark is the
// whole point of the hook. Both tiles ask the same relation the histogram does; only the left one
// passes `filterBy={crossfilter}`, and only the left one moves when you brush.
//
// `filterBy` defaults to exactly this selection, so the left tile could have omitted it. It is
// spelled out here because the right one had to say `null` to opt out.

export default function Example() {
  return (
    <MosaicDemo>
      <Panel />
    </MosaicDemo>
  );
}

function Panel() {
  const crossfilter = useCrossfilter();

  const brushed = useChartQuery({
    filterBy: crossfilter,
    query: (filter) => Query.from("telemetry").select({ rows: count() }).where(filter),
  });
  const everything = useChartQuery({
    filterBy: null,
    query: () => Query.from("telemetry").select({ rows: count() }),
  });

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <StatTile label="Under the brush" value={Number(brushed.row?.rows ?? 0)} />
        <StatTile label="In the relation" value={Number(everything.row?.rows ?? 0)} />
      </div>

      <ChartRoot height={170} table="telemetry">
        <ChartRectY fill="var(--muted-foreground)" filterBy={null} opacity={0.3} x={bin("latency")} y={count()} />
        <ChartRectY fill="var(--primary)" x={bin("latency")} y={count()} />
        <ChartIntervalX />
        <ChartAxisX label="latency (ms) — drag to brush" />
        <ChartAxisY label={null} />
      </ChartRoot>
    </div>
  );
}
