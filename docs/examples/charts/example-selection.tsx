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

// The page's selection is a default, not a cage: a mark still takes vgplot's own `filterBy` and an
// interactor its `as`. Here the example owns both selections: the bars' toggle publishes into
// `picked` (so they can highlight what you clicked), `picked` is relayed into `filter`, and the marks
// of the other two plots read `filter`. Nothing else on the page moves.

export default function Example() {
  const [picked] = useState(() => Selection.single());
  const [filter] = useState(() => Selection.crossfilter({ include: picked }));

  return (
    <MosaicDemo>
      <div className="grid w-full max-w-2xl grid-cols-1 gap-5 sm:grid-cols-2">
        <ChartRoot height={140} relation="sightings">
          <ChartBarY fill="var(--primary)" filterBy={null} x="region" y={count()} />
          <ChartToggleX as={picked} />
          <ChartHighlight by={picked} />
          <ChartAxisX label="click a region" tickRotate={30} />
          <ChartAxisY grid label={null} />
        </ChartRoot>

        <ChartRoot height={140} relation="sightings">
          <ChartRectY fill="var(--muted-foreground)" filterBy={null} opacity={0.25} x={bin("bounty")} y={count()} />
          <ChartRectY fill="var(--primary)" filterBy={filter} x={bin("bounty")} y={count()} />
          <ChartAxisX label="bounty (gold)" />
          <ChartAxisY grid label={null} />
        </ChartRoot>

        <ChartRoot height={140} relation="sightings">
          <ChartLineY filterBy={null} stroke="var(--muted-foreground)" strokeOpacity={0.4} x="hour" y={count()} />
          <ChartLineY filterBy={filter} stroke="var(--primary)" strokeWidth={2} x="hour" y={count()} />
          <ChartAxisX label="hour of day" ticks={12} />
          <ChartAxisY grid label={null} />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
