"use client";

import { Button } from "@kanzo-tech/ui";
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
import { ChartCard } from "@/lib/chart-card";
import { DashboardGrid } from "@/lib/dashboard-grid";
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
//      selection gets `status IN (…)` — the same clause a `ChartToggleColor` on the mark would
//      publish, from a control rather than from the plot area.
//   2. **It reads the selection back.** Unselected swatches drop to 0.2 opacity, which is why it
//      works as the page's status readout as well as its input.
//
// And one difference that looks like a detail and is not: the legend's toggle is built with
// `peers: false`, so its clause is *not* hidden from the plot it belongs to. Click a swatch and the
// right-hand plot filters itself — where `<ChartToggleColor />` on the mark is skipped by the
// crossfilter for its own marks and needs a `ChartHighlight` to show anything at all.
//
// Both legends only stay complete because the `config` pins the colour domain. Without it the scale
// is ordered by the data, so filtering to one status leaves the legend with one swatch — and a
// control that deletes the way back is worse than no control.

const config = {
  ok: { label: "OK", color: "var(--chart-2)" },
  slow: { label: "Slow", color: "var(--chart-4)" },
  error: { label: "Error", color: "var(--destructive)" },
} satisfies ChartConfig;

const ORDER = ["ok", "slow", "error"];

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
      <DashboardGrid minColumnWidth={260}>
        <ChartCard
          description="our DOM, under the plot"
          legend={<ChartLegend />}
          title="ChartLegend"
        >
          <ChartRoot config={config} height={150} table="telemetry">
            <ChartBarY fill="status" order={ORDER} tip x="region" y={count()} />
            <ChartAxisX label={null} />
            <ChartAxisY grid label={null} />
          </ChartRoot>
        </ChartCard>

        <ChartCard description="vgplot's, inside the plot — click a swatch" title="ChartColorLegend">
          <ChartRoot config={config} height={150} table="telemetry">
            <ChartBarY fill="status" order={ORDER} tip x="region" y={count()} />
            {/* The field is inferred from the `fill` channel; name it with `field` when the colour
                comes from an expression. `as={null}` would make it a static key instead. */}
            <ChartColorLegend />
            <ChartAxisX label={null} />
            <ChartAxisY grid label={null} />
          </ChartRoot>
        </ChartCard>
      </DashboardGrid>

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
