"use client";

import { useEffect, useState } from "react";
import { Badge, Skeleton, Show } from "@kanzo-tech/ui";
import {
  ChartAxisX,
  ChartAxisY,
  ChartIntervalX,
  ChartRectY,
  ChartRoot,
  bin,
  count,
  useMosaic,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "../charts/mosaic-demo";

// `coordinator` is the escape hatch, and it sits **outside** the crossfilter on purpose. A schema is
// the honest case for it: no brush can change what columns a relation has, so the list below is
// right to stay still while the histogram moves.
//
// Anything a brush *should* change goes through `useChartQuery` instead. A widget that runs
// `coordinator.query()` in an effect and shows a total looks identical on first paint, then reports
// unfiltered numbers beside filtered plots — which nobody reads as a stale widget.

interface ColumnInfo {
  column_name: string;
  column_type: string;
}

function useSchema(relation: string): ColumnInfo[] | null {
  const { coordinator } = useMosaic();
  const [columns, setColumns] = useState<ColumnInfo[] | null>(null);

  useEffect(() => {
    let live = true;
    coordinator.query(`DESCRIBE ${relation}`, { type: "json" }).then((rows) => {
      if (live) setColumns(rows as ColumnInfo[]);
    });
    return () => {
      live = false;
    };
  }, [coordinator, relation]);

  return columns;
}

export default function Example() {
  return (
    <MosaicDemo>
      <Panel />
    </MosaicDemo>
  );
}

function Panel() {
  const schema = useSchema("telemetry");

  return (
    <div className="flex w-full max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="font-medium text-muted-foreground text-xs">telemetry — columns</p>
        <Show fallback={<Skeleton className="h-6 w-full" />} when={schema !== null}>
          <div className="flex flex-wrap gap-1.5">
            {schema?.map((column) => (
              <Badge key={column.column_name} size="sm" variant="secondary">
                {column.column_name}
                <span className="text-muted-foreground">{column.column_type}</span>
              </Badge>
            ))}
          </div>
        </Show>
      </div>

      <ChartRoot height={170} table="telemetry">
        <ChartRectY fill="var(--muted-foreground)" filterBy={null} opacity={0.3} x={bin("latency")} y={count()} />
        <ChartRectY fill="var(--primary)" x={bin("latency")} y={count()} />
        <ChartIntervalX />
        <ChartAxisX label="latency (ms) — brush; the schema above does not move" />
        <ChartAxisY label={null} />
      </ChartRoot>
    </div>
  );
}
