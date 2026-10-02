"use client";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@kanzo-tech/ui";
import {
  ChartAxisX,
  ChartAxisY,
  ChartBarY,
  ChartColorLegend,
  ChartLegend,
  ChartRoot,
  type ChartConfig,
  count,
  useMosaic,
} from "@kanzo-tech/ui/analytics";
import { MosaicDemo } from "./mosaic-demo";

// Two legends over one series vocabulary. The left one is a key; the right one is a control.
//
// **`ChartLegend` is ours** — an `ark.ul` with `data-slot="chart-legend"`, placed wherever you put
// it, reading the root's `config`, so it carries the config's labels and icons and the label (not the
// swatch) is the accessible channel. It is DOM you can style, and it never publishes anything.
//
// **`ChartColorLegend` is vgplot's**, drawn *inside* the plot element by Plot's own legend renderer,
// and it does two things ours cannot:
//
//   1. **Clicking a swatch publishes.** It attaches Mosaic's `Toggle` to the swatches, so the
//      selection gets `verdict IN (…)` — the same clause a `ChartToggleColor` on the mark would
//      publish, from a control rather than from the plot area.
//   2. **It reads the selection back.** Unselected swatches drop to 0.2 opacity, which is why it
//      works as the page's verdict readout as well as its input.
//
// And one difference that looks like a detail and is not: the legend's toggle is built with
// `peers: false`, so its clause is *not* hidden from the plot it belongs to. Click a swatch and the
// right-hand plot filters itself — where `<ChartToggleColor />` on the mark is skipped by the
// crossfilter for its own marks and needs a `ChartHighlight` to show anything at all.
//
// Both legends only stay complete because the `config` pins the colour domain. Without it the scale
// is ordered by the data, so filtering to one verdict leaves the legend with one swatch — and a
// control that deletes the way back is worse than no control.

const config = {
  confirmed: { label: "Confirmed", color: "var(--chart-2)" },
  disputed: { label: "Disputed", color: "var(--chart-4)" },
  hoax: { label: "Hoax", color: "var(--destructive)" },
} satisfies ChartConfig;

const ORDER = ["confirmed", "disputed", "hoax"];

export default function Example() {
  return (
    <MosaicDemo>
      <Legends />
    </MosaicDemo>
  );
}

function Legends() {
  const { reset } = useMosaic();

  return (
    <div className="flex w-full max-w-3xl flex-col gap-3">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4">
        <Card className="[--space:--spacing(4)] gap-3">
          <CardHeader className="gap-0.5">
            <CardTitle className="font-medium text-sm">ChartLegend</CardTitle>
            <CardDescription className="text-xs">our DOM, under the plot</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
          <ChartRoot config={config} height={150} table="sightings">
            <ChartBarY fill="verdict" order={ORDER} tip x="region" y={count()} />
            <ChartAxisX label={null} />
            <ChartAxisY grid label={null} />
            <ChartLegend />
          </ChartRoot>
          </CardContent>
        </Card>

        <Card className="[--space:--spacing(4)] gap-3">
          <CardHeader className="gap-0.5">
            <CardTitle className="font-medium text-sm">ChartColorLegend</CardTitle>
            <CardDescription className="text-xs">vgplot's, inside the plot — click a swatch</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
          <ChartRoot config={config} height={150} table="sightings">
            <ChartBarY fill="verdict" order={ORDER} tip x="region" y={count()} />
            {/* The field is inferred from the `fill` channel; name it with `field` when the colour
                comes from an expression. `as={null}` would make it a static key instead. */}
            <ChartColorLegend />
            <ChartAxisX label={null} />
            <ChartAxisY grid label={null} />
          </ChartRoot>
          </CardContent>
        </Card>
      </div>

      <div>
        {/* Both plots read the provider's crossfilter, so the swatch on the right filters the plot
            on the left too — whose own legend cannot do it. */}
        <Button onClick={reset} size="sm" variant="outline">
          Clear selection
        </Button>
      </div>
    </div>
  );
}
