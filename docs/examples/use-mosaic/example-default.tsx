"use client";

import { Button, ButtonGroup, ButtonGroupText } from "@kanzo-tech/ui";
import {
  ChartAxisX,
  ChartAxisY,
  ChartBarY,
  ChartHighlight,
  ChartIntervalX,
  ChartRectY,
  ChartRoot,
  ChartToggleX,
  bin,
  count,
  useMosaic,
} from "@kanzo-tech/ui/analytics";
import { useClauses } from "@/lib/filter-chips";
import { MosaicDemo } from "../charts/mosaic-demo";

// One call for the whole context: the two shared selections, the coordinator, and the `reset()` a
// "Clear filters" button needs.
//
// `crossfilter.reset()` would not do: `Selection.reset()` travels downstream only, so it clears the
// shared selections and leaves each plot still holding the pick it published upstream — the bars
// stay highlighted with nothing on the page saying why.

const MARGIN = { top: 4, right: 8, bottom: 34, left: 34 };

export default function Example() {
  return (
    <MosaicDemo>
      <Panel />
    </MosaicDemo>
  );
}

function Panel() {
  const { crossfilter, reset } = useMosaic();
  const clauses = useClauses(crossfilter);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <ButtonGroup aria-label="Crossfilter">
        <ButtonGroupText>Filters: {clauses.length}</ButtonGroupText>
        <Button disabled={clauses.length === 0} onClick={reset} variant="outline">
          Clear filters
        </Button>
      </ButtonGroup>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <ChartRoot height={150} margin={MARGIN} table="telemetry">
          <ChartRectY fill="var(--muted-foreground)" filterBy={null} opacity={0.3} x={bin("latency")} y={count()} />
          <ChartRectY fill="var(--primary)" x={bin("latency")} y={count()} />
          <ChartIntervalX />
          <ChartAxisX label="latency (ms) — drag to brush" />
          <ChartAxisY label={null} />
        </ChartRoot>

        <ChartRoot height={150} margin={MARGIN} table="telemetry">
          <ChartBarY fill="var(--muted-foreground)" filterBy={null} opacity={0.3} x="region" y={count()} />
          <ChartBarY fill="var(--primary)" x="region" y={count()} />
          <ChartToggleX />
          <ChartHighlight />
          <ChartAxisX label="region — click to toggle" tickRotate={30} />
          <ChartAxisY label={null} />
        </ChartRoot>
      </div>
    </div>
  );
}
