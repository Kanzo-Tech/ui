"use client";

import { useEffect, useState } from "react";
import { Button, ButtonGroup, ButtonGroupText } from "@kanzo-tech/ui";
import {
  ChartAxisX,
  ChartAxisY,
  ChartBarY,
  ChartHighlight,
  ChartRectY,
  ChartRoot,
  ChartToggleX,
  Selection,
  bin,
  count,
  useMosaic,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "../charts/mosaic-demo";

// The left chart publishes into a selection this example owns — `Selection.single()`, so a click
// replaces the previous pick instead of accumulating. Passing `as` means the root stops wiring it
// for you, and an unregistered selection is invisible to `reset()`.
//
// `registerSelection(own, { relay: true })` buys back both halves: its clauses flow on into
// `selected` and from there into the crossfilter the histogram reads, and "Clear filters" reaches
// it. The returned unregister is the effect's cleanup.

const MARGIN = { top: 4, right: 8, bottom: 34, left: 34 };

export default function Example() {
  return (
    <MosaicDemo>
      <Panel />
    </MosaicDemo>
  );
}

function Panel() {
  const { registerSelection, reset } = useMosaic();
  const [own] = useState(() => Selection.single());

  useEffect(() => registerSelection(own, { relay: true }), [own, registerSelection]);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <ButtonGroup aria-label="Crossfilter">
        <ButtonGroupText>a selection of your own</ButtonGroupText>
        <Button onClick={reset} variant="outline">
          Clear filters
        </Button>
      </ButtonGroup>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <ChartRoot as={own} filterBy={null} height={150} margin={MARGIN} table="telemetry">
          <ChartBarY fill="var(--primary)" x="region" y={count()} />
          <ChartToggleX />
          <ChartHighlight by={own} />
          <ChartAxisX label="region — click one" tickRotate={30} />
          <ChartAxisY label={null} />
        </ChartRoot>

        <ChartRoot height={150} margin={MARGIN} table="telemetry">
          <ChartRectY fill="var(--muted-foreground)" filterBy={null} opacity={0.3} x={bin("latency")} y={count()} />
          <ChartRectY fill="var(--primary)" x={bin("latency")} y={count()} />
          <ChartAxisX label="latency (ms) — relayed to, so it follows" />
          <ChartAxisY label={null} />
        </ChartRoot>
      </div>
    </div>
  );
}
