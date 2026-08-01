"use client";

import { useState } from "react";
import { SegmentGroup, Show } from "@kanzo-tech/ui";
import {
  ChartAreaY,
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
import { MosaicDemo } from "./mosaic-demo";

// The interactor is a child, not a hardcoded line inside a preset: swapping click-to-toggle for
// drag-to-brush is a conditional in the JSX. A `false` child compiles to nothing, so the plot is
// rebuilt with the other interactor and the marks stay exactly as they were.
//
// The brush is its own feedback (you see the rectangle); the toggle is not, so it pairs with a
// `ChartHighlight`. Neither needs a prop — both default to the provider's pair.
//
// The x scale is linear, not band: an interval brush needs a continuous scale, so the count per
// hour is drawn as a line with dots rather than as bars. Both interactors work on those marks.

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
  // What the interactors publish into — `useSelected()`, not `useCrossfilter()`, because that is
  // the selection this chart's own clause lands in.
  const selected = useSelected();

  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      <SegmentGroup
        aria-label="Interactor"
        className="w-fit"
        onValueChange={(details) => {
          // Removing an interactor does not withdraw the clause it published; reset on the swap.
          selected.reset();
          setMode(details.value ?? "brush");
        }}
        options={MODES}
        value={mode}
        variant="solid"
      />

      <ChartRoot height={220} table="sightings">
        <ChartLineY filterBy={null} stroke="var(--muted-foreground)" strokeOpacity={0.35} x="hour" y={count()} />
        <ChartAreaY fill="var(--primary)" fillOpacity={0.12} x="hour" y={count()} />
        <ChartDot fill="var(--primary)" r={3.5} x="hour" y={count()} />
        {mode === "toggle" ? <ChartToggleX /> : <ChartIntervalX />}
        <Show when={mode === "toggle"}>
          <ChartHighlight />
        </Show>
        <ChartAxisX label="hour of day" ticks={12} />
        <ChartAxisY grid label={null} />
      </ChartRoot>
    </div>
  );
}
