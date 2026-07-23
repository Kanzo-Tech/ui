"use client";

import * as vg from "@uwdata/vgplot";
import type { Selection } from "@uwdata/mosaic-core";
import { useCrossfilter } from "./mosaic-provider.js";
import { TokenizedPlot } from "./tokenized-plot.js";

export interface LineChartProps {
  /** The table / relation name registered in the coordinator. */
  table: string;
  /** The ordered (numeric or temporal) column for the x axis. */
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
 * A tokenised crossfilter line chart of a **count over an ordered axis** (time-of-day, a bucket,
 * any monotonic column).
 *
 * Same dual-layer crossfilter story as {@link Histogram}, but a line is **stroked, not filled**:
 * a dimmed `--muted-foreground` line traces the full series and a `--primary` line, `filterBy` the
 * shared selection, traces the crossfilter subset on top. Dragging an interval (`intervalX`)
 * brushes a range of the axis into the selection, which filters every chart bound to it.
 */
export function LineChart({ table, column, selection, height = 120, className }: LineChartProps) {
  const shared = useCrossfilter();
  const sel = selection ?? shared;

  return (
    <TokenizedPlot
      className={className}
      deps={[table, column, sel, height]}
      render={({ primary, muted }) =>
        vg.plot(
          // Background: the full series, dimmed. A line is stroked, so the token maps to `stroke`.
          vg.lineY(vg.from(table), { x: column, y: vg.count(), stroke: muted, strokeOpacity: 0.4 }),
          // Foreground: the current crossfilter subset.
          vg.lineY(vg.from(table, { filterBy: sel }), { x: column, y: vg.count(), stroke: primary }),
          // Drag an interval along the axis into the shared selection.
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
