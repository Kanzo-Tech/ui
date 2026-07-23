"use client";

import * as vg from "@uwdata/vgplot";
import type { Selection } from "@uwdata/mosaic-core";
import { useCrossfilter } from "./mosaic-provider.js";
import { TokenizedPlot } from "./tokenized-plot.js";

export interface ScatterPlotProps {
  /** The table / relation name registered in the coordinator. */
  table: string;
  /** The numeric column for the x axis. */
  x: string;
  /** The numeric column for the y axis. */
  y: string;
  /**
   * The crossfilter selection this chart publishes to and filters by. Defaults to the shared
   * `Selection` from the surrounding `<MosaicProvider>`.
   */
  selection?: Selection;
  /** Plot height in px. Default 120. */
  height?: number;
  /** Dot radius in px. Default 2. */
  radius?: number;
  className?: string;
}

/**
 * A tokenised crossfilter scatter plot of two **numeric** columns.
 *
 * The same dual-layer crossfilter story as {@link Histogram}, in two dimensions: a dimmed
 * `--muted-foreground` layer plots every point and a `--primary` layer, `filterBy` the shared
 * selection, plots the crossfilter subset on top. Dragging a 2-D rectangle (`intervalXY`) brushes
 * an x/y region into the selection, which filters every chart bound to it.
 */
export function ScatterPlot({ table, x, y, selection, height = 120, radius = 2, className }: ScatterPlotProps) {
  const shared = useCrossfilter();
  const sel = selection ?? shared;

  return (
    <TokenizedPlot
      className={className}
      deps={[table, x, y, sel, height, radius]}
      render={({ primary, muted }) =>
        vg.plot(
          // Background: every point, dimmed.
          vg.dot(vg.from(table), { x, y, r: radius, fill: muted, fillOpacity: 0.3 }),
          // Foreground: the current crossfilter subset.
          vg.dot(vg.from(table, { filterBy: sel }), { x, y, r: radius, fill: primary }),
          // Drag a 2-D rectangle into the shared selection.
          vg.intervalXY({ as: sel }),
          vg.height(height),
          vg.marginLeft(30),
          vg.marginRight(4),
          vg.marginTop(4),
          vg.marginBottom(20),
          vg.xAxis("bottom"),
          vg.yAxis("left"),
        )
      }
    />
  );
}
