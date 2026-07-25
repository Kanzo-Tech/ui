"use client";

import { useState } from "react";
import {
  ChartAxisX,
  ChartAxisY,
  ChartBarY,
  ChartHighlight,
  ChartLineY,
  ChartRectY,
  ChartRoot,
  ChartToggleX,
  Selection,
  bin,
  count,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// The provider's crossfilter is a default, not a cage. Here the example owns both selections: the
// bars publish into `picked` (so they can highlight what you clicked), `picked` is relayed into
// `filter`, and the other two plots read `filter`. Nothing else on the page moves.

export default function Example() {
  const [picked] = useState(() => Selection.single());
  const [filter] = useState(() => Selection.crossfilter({ include: picked }));

  return (
    <MosaicDemo>
      <div className="grid w-full max-w-2xl grid-cols-1 gap-5 sm:grid-cols-2">
        <ChartRoot as={picked} filterBy={null} height={140} table="telemetry">
          <ChartBarY fill="var(--primary)" x="region" y={count()} />
          <ChartToggleX />
          <ChartHighlight by={picked} />
          <ChartAxisX label="click a region" tickRotate={30} />
          <ChartAxisY grid label={null} />
        </ChartRoot>

        <ChartRoot filterBy={filter} height={140} table="telemetry">
          <ChartRectY fill="var(--muted-foreground)" filterBy={null} opacity={0.25} x={bin("latency")} y={count()} />
          <ChartRectY fill="var(--primary)" x={bin("latency")} y={count()} />
          <ChartAxisX label="latency (ms)" />
          <ChartAxisY grid label={null} />
        </ChartRoot>

        <ChartRoot filterBy={filter} height={140} table="telemetry">
          <ChartLineY filterBy={null} stroke="var(--muted-foreground)" strokeOpacity={0.4} x="hour" y={count()} />
          <ChartLineY stroke="var(--primary)" strokeWidth={2} x="hour" y={count()} />
          <ChartAxisX label="hour of day" ticks={12} />
          <ChartAxisY grid label={null} />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
