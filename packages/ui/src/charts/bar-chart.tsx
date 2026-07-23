"use client";

import * as vg from "@uwdata/vgplot";
import type { Selection } from "@uwdata/mosaic-core";
import { useCrossfilter } from "./mosaic-provider.js";
import { TokenizedPlot } from "./tokenized-plot.js";

export interface BarChartProps {
  /** The table / relation name registered in the coordinator. */
  table: string;
  /** The categorical column to group by. */
  column: string;
  /**
   * The crossfilter selection this chart publishes to and filters by. Defaults to the shared
   * `Selection` from the surrounding `<MosaicProvider>`.
   */
  selection?: Selection;
  /** Plot height in px. Default 120. */
  height?: number;
  /** Cap on the number of categories shown, top-N by count. Default 8. */
  limit?: number;
  className?: string;
}

/**
 * A tokenised crossfilter bar chart for a **categorical** column.
 *
 * The categorical counterpart to {@link Histogram}, and the same dual-layer story: a dimmed
 * `--muted-foreground` layer shows the full per-category counts, a `--primary` layer `filterBy`
 * the shared selection shows the crossfilter subset on top, and clicking a bar toggles that
 * category into the selection (`toggleX`) — which filters every chart bound to it. Bars are sorted
 * by descending count and capped at `limit` so a high-cardinality column stays readable.
 */
export function BarChart({ table, column, selection, height = 120, limit = 8, className }: BarChartProps) {
  const shared = useCrossfilter();
  const sel = selection ?? shared;

  return (
    <TokenizedPlot
      className={className}
      deps={[table, column, sel, height, limit]}
      render={({ primary, muted }) =>
        vg.plot(
          // Background: every category's full count, dimmed.
          vg.barY(vg.from(table), { x: column, y: vg.count(), fill: muted, opacity: 0.3, sort: { x: "-y" }, limit }),
          // Foreground: the current crossfilter subset.
          vg.barY(vg.from(table, { filterBy: sel }), { x: column, y: vg.count(), fill: primary, sort: { x: "-y" }, limit }),
          // Categorical → click to toggle a category into the shared selection.
          vg.toggleX({ as: sel }),
          vg.height(height),
          vg.marginLeft(30),
          vg.marginRight(4),
          vg.marginTop(4),
          vg.marginBottom(24),
          vg.yAxis(null),
          vg.xAxis("bottom"),
          vg.xTickRotate(45),
        )
      }
    />
  );
}
