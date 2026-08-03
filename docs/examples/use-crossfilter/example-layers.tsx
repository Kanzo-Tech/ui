"use client";

import {
  ChartAxisX,
  ChartAxisY,
  ChartBarY,
  ChartHighlight,
  ChartRectY,
  ChartRoot,
  ChartToggleX,
  bin,
  count,
  useCrossfilter,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "../charts/mosaic-demo";

// The dual-layer idiom with the default taken away: the right root says `filterBy={null}`, so both
// its marks read the full relation until one of them asks not to. That one gets the selection from
// `useCrossfilter()` — the same object `ChartRoot` would have handed it.
//
// Which is the useful shape when only *part* of a plot should follow the brush: the ghost layer is
// the context, the solid layer is the answer.

const MARGIN = { top: 4, right: 8, bottom: 34, left: 34 };

export default function Example() {
  return (
    <MosaicDemo>
      <Panel />
    </MosaicDemo>
  );
}

function Panel() {
  const crossfilter = useCrossfilter();

  return (
    <div className="grid w-full max-w-2xl grid-cols-1 gap-5 sm:grid-cols-2">
      <ChartRoot height={160} margin={MARGIN} table="telemetry">
        <ChartBarY fill="var(--primary)" x="region" y={count()} />
        <ChartToggleX />
        <ChartHighlight />
        <ChartAxisX label="region — click to publish" tickRotate={30} />
        <ChartAxisY label={null} />
      </ChartRoot>

      <ChartRoot filterBy={null} height={160} margin={MARGIN} table="telemetry">
        <ChartRectY fill="var(--muted-foreground)" opacity={0.3} x={bin("latency")} y={count()} />
        <ChartRectY fill="var(--primary)" filterBy={crossfilter} x={bin("latency")} y={count()} />
        <ChartAxisX label="latency (ms) — one layer opted in" />
        <ChartAxisY label={null} />
      </ChartRoot>
    </div>
  );
}
