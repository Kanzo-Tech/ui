"use client";

import { Suspense } from "react";
import { Badge, Skeleton } from "@kanzo-tech/ui";
import {
  ChartAxisX,
  ChartAxisY,
  ChartIntervalX,
  ChartRectY,
  ChartRoot,
  bin,
  count,
  useQueryRows,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "../charts/mosaic-demo";

// A schema is the honest case for a read outside the crossfilter: no brush can change what columns a
// relation has, so the list below is right to stay still while the histogram moves. It suspends
// until the answer lands, and the `Suspense` around it draws the wait.
//
// Anything a brush *should* change goes through `useChartQuery` instead.

interface ColumnInfo {
  column_name: string;
  column_type: string;
}

function Schema({ relation }: { relation: string }) {
  const columns = useQueryRows<ColumnInfo>(`DESCRIBE ${relation}`);
  return (
    <div className="flex flex-wrap gap-1.5">
      {columns.map((column) => (
        <Badge key={column.column_name} size="sm" variant="secondary">
          {column.column_name}
          <span className="text-muted-foreground">{column.column_type}</span>
        </Badge>
      ))}
    </div>
  );
}

export default function Example() {
  return (
    <MosaicDemo>
      <Panel />
    </MosaicDemo>
  );
}

function Panel() {
  return (
    <div className="flex w-full max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="font-medium text-muted-foreground text-xs">telemetry — columns</p>
        <Suspense fallback={<Skeleton className="h-6 w-full" />}>
          <Schema relation="telemetry" />
        </Suspense>
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
