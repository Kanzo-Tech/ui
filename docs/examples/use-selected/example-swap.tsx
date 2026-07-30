"use client";

import { useState } from "react";
import { SegmentGroup, Show } from "@kanzo-tech/ui";
import {
  ChartAxisX,
  ChartAxisY,
  ChartDot,
  ChartHighlight,
  ChartIntervalX,
  ChartLineY,
  ChartRoot,
  ChartToggleX,
  count,
  useSelected,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "../charts/mosaic-demo";

// Removing an interactor does not withdraw the clause it published — the plot is rebuilt, the
// clause stays, and the page is filtered by a control that is no longer on screen.
//
// The withdrawal goes through `useSelected()`, not `useCrossfilter()`: `selected` is the selection
// this chart's own clause landed in, and resetting there relays the removal onward into the
// crossfilter. Resetting the crossfilter instead would clear the downstream copy and leave the
// upstream original in place.

const MODES = [
  { value: "brush", label: "ChartIntervalX" },
  { value: "toggle", label: "ChartToggleX" },
] as const;

export default function Example() {
  return (
    <MosaicDemo>
      <Swap />
    </MosaicDemo>
  );
}

function Swap() {
  const [mode, setMode] = useState<string>("brush");
  const selected = useSelected();

  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      <SegmentGroup
        aria-label="Interactor"
        className="w-fit"
        onValueChange={(details) => {
          selected.reset();
          setMode(details.value ?? "brush");
        }}
        options={MODES}
        value={mode}
        variant="solid"
      />

      <ChartRoot height={200} table="telemetry">
        <ChartLineY filterBy={null} stroke="var(--muted-foreground)" strokeOpacity={0.35} x="hour" y={count()} />
        <ChartLineY stroke="var(--primary)" x="hour" y={count()} />
        <ChartDot fill="var(--primary)" r={3} x="hour" y={count()} />
        {mode === "toggle" ? <ChartToggleX /> : <ChartIntervalX />}
        <Show when={mode === "toggle"}>
          <ChartHighlight />
        </Show>
        <ChartAxisX label="hour of day" ticks={10} />
        <ChartAxisY grid label={null} />
      </ChartRoot>
    </div>
  );
}
