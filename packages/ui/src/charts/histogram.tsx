"use client";

import * as vg from "@uwdata/vgplot";
import type { Selection } from "@uwdata/mosaic-core";
import { useCrossfilter } from "./mosaic-provider.js";
import { TokenizedPlot } from "./tokenized-plot.js";

export interface HistogramProps {
  /** The table / relation name registered in the coordinator. */
  table: string;
  /** The numeric (or temporal) column to bin. */
  column: string;
  /**
   * The crossfilter selection this chart publishes to and filters by. Defaults to the shared
   * `Selection` from the surrounding `<MosaicProvider>`.
   */
  selection?: Selection;
  /** Plot height in px. Default 120. */
  height?: number;
  className?: string;
}

/**
 * A tokenised crossfilter histogram for a **numeric or temporal** column.
 *
 * Dual-layer, the pattern from keasy's discovery view: a dimmed `--muted-foreground` layer draws
 * the *whole* distribution while a `--primary` layer, `filterBy` the shared selection, draws the
 * current crossfilter subset on top. Dragging an interval brush (`intervalX`) publishes the range
 * to the selection, which filters every other chart bound to it.
 *
 * The only thing this adds over raw vgplot is tokenisation: vgplot hard-codes `#94a3b8`/`steelblue`;
 * here the two layers read `--muted-foreground` / `--primary`, so the chart re-themes with the
 * design system.
 */
export function Histogram({ table, column, selection, height = 120, className }: HistogramProps) {
  const shared = useCrossfilter();
  const sel = selection ?? shared;

  return (
    <TokenizedPlot
      className={className}
      deps={[table, column, sel, height]}
      render={({ primary, muted }) =>
        vg.plot(
          // Background: the full distribution, dimmed.
          vg.rectY(vg.from(table), { x: vg.bin(column), y: vg.count(), fill: muted, opacity: 0.3 }),
          // Foreground: the current crossfilter subset.
          vg.rectY(vg.from(table, { filterBy: sel }), { x: vg.bin(column), y: vg.count(), fill: primary }),
          // Numeric → drag an interval brush into the shared selection.
          vg.intervalX({ as: sel }),
          vg.height(height),
          vg.marginLeft(30),
          vg.marginRight(4),
          vg.marginTop(4),
          vg.marginBottom(20),
          vg.yAxis(null),
          vg.xAxis("bottom"),
        )
      }
    />
  );
}
