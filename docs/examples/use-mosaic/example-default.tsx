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
  useClauses,
  useMosaic,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "../charts/mosaic-demo";

// One call for the whole context: the coordinator, the page's one selection and its joins. Every
// chart publishes into that selection, so "Clear filters" is Mosaic's own `selection.reset()`: it
// takes every clause out and calls each one's source back, so the brush and the pick clear with it.

const MARGIN = { top: 4, right: 8, bottom: 34, left: 34 };

export default function Example() {
  return (
    <MosaicDemo>
      <Panel />
    </MosaicDemo>
  );
}

function Panel() {
  const { selection } = useMosaic();
  const clauses = useClauses(selection);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <ButtonGroup aria-label="Crossfilter">
        <ButtonGroupText>Filters: {clauses.length}</ButtonGroupText>
        <Button disabled={clauses.length === 0} onClick={() => selection.reset()} variant="outline">
          Clear filters
        </Button>
      </ButtonGroup>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <ChartRoot height={150} margin={MARGIN} relation="telemetry">
          <ChartRectY fill="var(--muted-foreground)" filterBy={null} opacity={0.3} x={bin("latency")} y={count()} />
          <ChartRectY fill="var(--primary)" x={bin("latency")} y={count()} />
          <ChartIntervalX />
          <ChartAxisX label="latency (ms) — drag to brush" />
          <ChartAxisY label={null} />
        </ChartRoot>

        <ChartRoot height={150} margin={MARGIN} relation="telemetry">
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
