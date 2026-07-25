"use client";

import { axisX } from "@uwdata/vgplot";
import {
  ChartAxisX,
  ChartAxisY,
  ChartBarX,
  ChartHighlight,
  ChartRaw,
  ChartRoot,
  ChartToggleY,
  count,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// The layer wraps every mark vgplot ships but six: `axisX`, `axisY`, `axisFx`, `axisFy`, `gridFx`
// and `gridFy`. That gap is deliberate — `ChartAxisX` and friends compile to plot *attributes*,
// because an axis mark would steal the binding from the interactor after it — and it is exactly
// what `ChartRaw` is for. A plot has one `xAxis` attribute, so it draws one x axis; the measure
// scale repeated at the top, where a long bar list needs it, is the unwrapped `axisX` **mark**.
//
// Both anchors are spelled out because Plot only adds its implicit axis when the plot has no axis
// mark for that scale: declare one and you own them all. The scale itself is still `ChartAxisX`'s —
// the grid and the label come from there, and the marks inherit them.
//
// Two more things follow from a raw directive being a mark like any other. It takes its place in
// source order, so it is declared *after* `ChartToggleY` — put it first and the toggle would bind
// to an axis instead of the bars. And it is a function, so it is hoisted to module scope: built
// inline it would be a new identity on every render and the plot would rebuild.

const AXES = [axisX({ anchor: "bottom" }), axisX({ anchor: "top", label: null })];

export default function Example() {
  return (
    <MosaicDemo>
      <div className="w-full max-w-xl">
        <ChartRoot
          height={180}
          margin={{ top: 28, right: 16, bottom: 32, left: 76 }}
          table="telemetry"
        >
          <ChartBarX
            fill="var(--muted-foreground)"
            filterBy={null}
            opacity={0.25}
            sort={{ y: "-x" }}
            x={count()}
            y="region"
          />
          <ChartBarX fill="var(--primary)" sort={{ y: "-x" }} tip x={count()} y="region" />
          <ChartToggleY />
          <ChartHighlight />
          <ChartRaw spec={AXES} />
          <ChartAxisX grid label="requests" />
          <ChartAxisY label={null} />
        </ChartRoot>
      </div>
    </MosaicDemo>
  );
}
