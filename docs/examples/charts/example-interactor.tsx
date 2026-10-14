"use client";

import { useState } from "react";
import { SegmentGroup } from "@kanzo-tech/ui";
import { count } from "@kanzo-tech/mosaic";
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
  useMosaic,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// The interactor is a child, not a hardcoded line inside a preset: swapping click-to-toggle for
// drag-to-brush is a conditional in the JSX. A `false` child compiles to nothing, so the plot is
// rebuilt with the other interactor and the marks stay exactly as they were.
//
// The brush is its own feedback (you see the rectangle); the toggle is not, so it pairs with a
// `ChartHighlight`. Neither needs a prop — both default to the page's selection.
//
// Both conditionals stay `&&`/ternary rather than `Show`, and that is the one place in docs/ where
// the house rule does not apply: the compiler walks the element tree without rendering it, so a
// descriptor inside any consumer component — `Show` included — is invisible to it.
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
  // What the interactors publish into: the page's one selection.
  const { selection } = useMosaic();

  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      <SegmentGroup
        aria-label="Interactor"
        className="w-fit"
        onValueChange={(details) => {
          // Removing an interactor does not withdraw the clause it published; reset on the swap.
          selection.reset();
          setMode(details.value ?? "brush");
        }}
        options={MODES}
        value={mode}
        variant="solid"
      />

      <ChartRoot height={220} relation="sightings">
        <ChartLineY filterBy={null} stroke="var(--muted-foreground)" strokeOpacity={0.35} x="hour" y={count()} />
        <ChartAreaY fill="var(--primary)" fillOpacity={0.12} x="hour" y={count()} />
        <ChartDot fill="var(--primary)" r={3.5} x="hour" y={count()} />
        {mode === "toggle" ? <ChartToggleX /> : <ChartIntervalX />}
        {mode === "toggle" && <ChartHighlight />}
        <ChartAxisX label="hour of day" ticks={12} />
        <ChartAxisY grid label={null} />
      </ChartRoot>
    </div>
  );
}
