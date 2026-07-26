"use client";

import type { Selection } from "@uwdata/mosaic-core";
import { chartDescriptor, type ChartDescriptor, type ChartInteractorDirective } from "./chart-spec.js";

/**
 * The interactor vocabulary. Inert descriptors, like the marks.
 *
 * vgplot binds an interactor to the **last mark added before it**, so order inside `ChartRoot` is
 * semantic: put the interactor after the mark it should drive.
 */

export interface ChartInteractorProps {
  /** Where the interaction publishes. Defaults to `ChartRoot`'s `as` — the selection that root owns. */
  as?: Selection | null;
  /** Any other vgplot interactor option (`peers`, `brush`, `pixelSize`, `empty`…). */
  [option: string]: unknown;
}

function interactor(displayName: string, type: string): ChartDescriptor<ChartInteractorProps> {
  return chartDescriptor<ChartInteractorProps>(displayName, (props, ctx): ChartInteractorDirective => {
    const { as, ...rest } = props;
    return { kind: "interactor", interactor: type, options: { ...rest, as: as === undefined ? ctx.as : as } };
  });
}

export const ChartIntervalX = interactor("ChartIntervalX", "intervalX");
export const ChartIntervalY = interactor("ChartIntervalY", "intervalY");
export const ChartIntervalXY = interactor("ChartIntervalXY", "intervalXY");
export const ChartToggleX = interactor("ChartToggleX", "toggleX");
export const ChartToggleY = interactor("ChartToggleY", "toggleY");
export const ChartToggleColor = interactor("ChartToggleColor", "toggleColor");
export const ChartNearestX = interactor("ChartNearestX", "nearestX");
export const ChartNearestY = interactor("ChartNearestY", "nearestY");
export const ChartRegion = interactor("ChartRegion", "region");

export interface ChartHighlightProps {
  /**
   * The selection to highlight by — vgplot spells this `by`, not `as`. Defaults to `ChartRoot`'s
   * own selection, which is the only value guaranteed to be safe; see below before overriding it.
   */
  by?: Selection | null;
  /** The channels applied to the de-emphasised marks (`opacity`, `fill`, `stroke`…). */
  [channel: string]: unknown;
}

/**
 * Dims the marks outside `by` instead of publishing a selection — it reads, it does not write.
 *
 * **`by` is not a filter.** The highlight appends `by`'s predicate to the mark's own query as an
 * extra output column, and on an aggregating mark that query has a `GROUP BY` — so a predicate
 * naming a column the plot does not group by is a DuckDB binder error. Mosaic swallows it and the
 * plot keeps its previous render, silently. Leaving `by` off is what keeps that impossible: the
 * root's own selection can only hold clauses its own interactors published, over its own columns.
 * `ChartRoot` warns in development when an explicit `by` gives that away.
 */
export const ChartHighlight = chartDescriptor<ChartHighlightProps>("ChartHighlight", (props, ctx) => {
  const { by, ...channels } = props;
  return { kind: "interactor", interactor: "highlight", options: { ...channels, by: by === undefined ? ctx.as : by } };
});

/**
 * Clearer aliases for the two ways of selecting, because vgplot's own pair mixes criteria:
 * `toggle` names the gesture, `interval` names the result. Both spellings work, and the vgplot names
 * stay so anyone reading Mosaic's documentation lands on the same component.
 *
 * This block used to claim "the docs teach these". They did not — a measurement found zero mentions
 * of any `Pick`/`Brush` name across every `.mdx`, while both spellings ran side by side in examples
 * and one showcase, sometimes in the same file. The pairing is now a table under
 * "Interactors" in `charts.mdx`. If you add an alias here, teach it there in the same commit.
 *
 * **Pick** is discrete: click a bar, get `region IN (…)`. Needs a categorical/band scale.
 * **Brush** is continuous: drag the axis, get `latency BETWEEN lo AND hi`. Needs a scale with a
 * "between" — brushing a band scale throws inside Mosaic, which `ChartRoot` warns about.
 */
export const ChartPickX = ChartToggleX;
export const ChartPickY = ChartToggleY;
export const ChartPickColor = ChartToggleColor;
export const ChartBrushX = ChartIntervalX;
export const ChartBrushY = ChartIntervalY;
export const ChartBrushXY = ChartIntervalXY;

export interface ChartPanZoomProps {
  /** Restrict panning/zooming to an axis, or bind the resulting domain to a `Selection`/`Param`. */
  x?: unknown;
  y?: unknown;
  zoom?: boolean;
  panx?: boolean;
  pany?: boolean;
  [option: string]: unknown;
}

/** Pan and zoom the plot's scales. Carries no selection — it rewrites the domains in place. */
export const ChartPanZoom = chartDescriptor<ChartPanZoomProps>("ChartPanZoom", (props) => ({
  kind: "interactor",
  interactor: "panZoom",
  options: { ...props },
}));
