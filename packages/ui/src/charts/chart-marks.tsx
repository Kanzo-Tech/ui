"use client";

import type { Selection } from "@uwdata/mosaic-core";
import { isColorToken } from "./chart-config.js";
import {
  chartDescriptor,
  type ChartDescriptor,
  type ChartMarkDirective,
  type ChartMarkSource,
  type ChartSpecContext,
} from "./chart-spec.js";

/**
 * The mark vocabulary. Every component here renders `null` — `ChartRoot` reads the `__chart`
 * static off the element type and compiles it. `"use client"` is load-bearing even though nothing
 * here uses a hook: a server-rendered descriptor would collapse to `null` before `ChartRoot`
 * ever sees it.
 */

export interface ChartMarkProps {
  /**
   * The selection this mark filters by. Defaults to `ChartRoot`'s; `null` draws the full relation
   * — the dimmed background layer of a crossfilter pair.
   */
  filterBy?: Selection | null;
  /** Literal rows instead of the root's table. */
  data?: readonly unknown[];
  /** Positions a rule/tick without a table: `at={0}` is the zero line. */
  at?: unknown;
  /** Observable Plot's per-mark hover tooltip. */
  tip?: boolean;
  x?: unknown;
  y?: unknown;
  z?: unknown;
  r?: unknown;
  /** Facet the plot horizontally by this column — one panel per distinct value. */
  fx?: unknown;
  /** Facet the plot vertically by this column. */
  fy?: unknown;
  /** A column name, or a colour — `var(--chart-1)` / `--primary` tokens are resolved for Plot. */
  fill?: unknown;
  /** A column name, or a colour; tokens are resolved the same way. */
  stroke?: unknown;
  opacity?: unknown;
  fillOpacity?: unknown;
  strokeOpacity?: unknown;
  strokeWidth?: unknown;
  sort?: unknown;
  reverse?: boolean;
  limit?: number;
  inset?: number;
  /** Any other vgplot / Observable Plot mark option. */
  [option: string]: unknown;
}

/** Only these two channels can hold a colour; everything else keeps its column name. */
const COLOR_CHANNELS = ["fill", "stroke"] as const;

/**
 * Marks that stack, and therefore need a series key.
 *
 * In Observable Plot `z` defaults to `fill`, so a stacked bar coloured by a column just works.
 * Through Mosaic it does not: the fill arrives as `{ value, scale: "color" }`, `maybeZ` cannot
 * pull a series name out of that object, and `stackY` silently stacks every row on the previous
 * one — a chart that renders, looks plausible and is wrong, which is worse than one that throws.
 * So we restore Plot's own default: a column-valued `fill`/`stroke` becomes `z` unless the caller
 * set one. `z={null}` opts out (Plot's own way of saying "do not group").
 */
const STACKING_MARKS = new Set([
  "barY", "barX", "areaY", "areaX", "area", "rectY", "rectX", "rect", "waffleY", "waffleX",
]);

function markSource(props: ChartMarkProps, ctx: ChartSpecContext, decorator: boolean): ChartMarkSource {
  if (decorator) return null;
  if (props.data !== undefined) return { kind: "values", values: props.data };
  if (props.at !== undefined) return { kind: "values", values: Array.isArray(props.at) ? props.at : [props.at] };
  if (ctx.table === undefined) return { kind: "values", values: [{}] };
  return {
    kind: "table",
    table: ctx.table,
    filterBy: props.filterBy === undefined ? ctx.filterBy : props.filterBy,
  };
}

function markDirective(mark: string, props: ChartMarkProps, ctx: ChartSpecContext, decorator: boolean): ChartMarkDirective {
  const channels: Record<string, unknown> = { ...props };
  // `filterBy` / `data` / `at` are our sugar; they choose the source, they are never mark options.
  delete channels.filterBy;
  delete channels.data;
  delete channels.at;
  // Read the series key before the colour channels are resolved to `rgb(...)` strings.
  if (STACKING_MARKS.has(mark) && !("z" in channels)) {
    const series = [channels.fill, channels.stroke].find(
      (v) => typeof v === "string" && !isColorToken(v),
    );
    if (series !== undefined) channels.z = series;
  }
  for (const channel of COLOR_CHANNELS) {
    const value = channels[channel];
    // `fill="host"` is the *column* host; only a token reference is a colour we must resolve.
    if (typeof value === "string" && isColorToken(value)) channels[channel] = ctx.resolveColor(value);
  }
  return { kind: "mark", mark, source: markSource(props, ctx, decorator), options: channels };
}

function mark(displayName: string, type: string, decorator = false): ChartDescriptor<ChartMarkProps> {
  return chartDescriptor<ChartMarkProps>(displayName, (props, ctx) => markDirective(type, props, ctx, decorator));
}

export const ChartBarY = mark("ChartBarY", "barY");
export const ChartBarX = mark("ChartBarX", "barX");
export const ChartWaffleY = mark("ChartWaffleY", "waffleY");
export const ChartWaffleX = mark("ChartWaffleX", "waffleX");

export const ChartLine = mark("ChartLine", "line");
export const ChartLineY = mark("ChartLineY", "lineY");
export const ChartLineX = mark("ChartLineX", "lineX");
export const ChartArea = mark("ChartArea", "area");
export const ChartAreaY = mark("ChartAreaY", "areaY");
export const ChartAreaX = mark("ChartAreaX", "areaX");

export const ChartDot = mark("ChartDot", "dot");
export const ChartDotX = mark("ChartDotX", "dotX");
export const ChartDotY = mark("ChartDotY", "dotY");
export const ChartCircle = mark("ChartCircle", "circle");
export const ChartHexagon = mark("ChartHexagon", "hexagon");
export const ChartImage = mark("ChartImage", "image");

export const ChartRect = mark("ChartRect", "rect");
export const ChartRectY = mark("ChartRectY", "rectY");
export const ChartRectX = mark("ChartRectX", "rectX");
export const ChartCell = mark("ChartCell", "cell");
export const ChartCellX = mark("ChartCellX", "cellX");
export const ChartCellY = mark("ChartCellY", "cellY");

export const ChartRuleY = mark("ChartRuleY", "ruleY");
export const ChartRuleX = mark("ChartRuleX", "ruleX");
export const ChartTickX = mark("ChartTickX", "tickX");
export const ChartTickY = mark("ChartTickY", "tickY");
export const ChartText = mark("ChartText", "text");
export const ChartTextX = mark("ChartTextX", "textX");
export const ChartTextY = mark("ChartTextY", "textY");

export const ChartVector = mark("ChartVector", "vector");
// vgplot 0.29.2 builds this one with the mark type `vectoX`, which Observable Plot has no
// function for. Wrapped for symmetry; use `<ChartVector>` until upstream fixes the typo.
export const ChartVectorX = mark("ChartVectorX", "vectorX");
export const ChartVectorY = mark("ChartVectorY", "vectorY");
export const ChartSpike = mark("ChartSpike", "spike");
export const ChartArrow = mark("ChartArrow", "arrow");
export const ChartLink = mark("ChartLink", "link");

export const ChartHeatmap = mark("ChartHeatmap", "heatmap");
export const ChartRaster = mark("ChartRaster", "raster");
export const ChartRasterTile = mark("ChartRasterTile", "rasterTile");
export const ChartContour = mark("ChartContour", "contour");
export const ChartDenseLine = mark("ChartDenseLine", "denseLine");
export const ChartDensity = mark("ChartDensity", "density");
export const ChartDensityY = mark("ChartDensityY", "densityY");
export const ChartDensityX = mark("ChartDensityX", "densityX");
export const ChartHexbin = mark("ChartHexbin", "hexbin");
export const ChartRegressionY = mark("ChartRegressionY", "regressionY");
export const ChartErrorbarY = mark("ChartErrorbarY", "errorbarY");
export const ChartErrorbarX = mark("ChartErrorbarX", "errorbarX");

export const ChartVoronoi = mark("ChartVoronoi", "voronoi");
export const ChartVoronoiMesh = mark("ChartVoronoiMesh", "voronoiMesh");
export const ChartDelaunayLink = mark("ChartDelaunayLink", "delaunayLink");
export const ChartDelaunayMesh = mark("ChartDelaunayMesh", "delaunayMesh");
export const ChartHull = mark("ChartHull", "hull");
export const ChartGeo = mark("ChartGeo", "geo");

// Decorators: they draw the frame, not the data, so vgplot gives them options and no source.
export const ChartFrame = mark("ChartFrame", "frame", true);
export const ChartGridX = mark("ChartGridX", "gridX", true);
export const ChartGridY = mark("ChartGridY", "gridY", true);
export const ChartHexgrid = mark("ChartHexgrid", "hexgrid", true);
export const ChartSphere = mark("ChartSphere", "sphere", true);
export const ChartGraticule = mark("ChartGraticule", "graticule", true);

export interface ChartRawProps {
  /** A `vg.*` directive, or several — `vg.axisFx({ anchor: "top" })`. */
  spec: unknown;
}

/**
 * The escape hatch. The wrappers above cover vgplot's mark vocabulary, but not its ~250 attributes
 * nor the `axisX`/`axisFy` decorator marks the axis descriptors deliberately compile away from.
 * Anything unwrapped goes in here, in source order, with the same interactor-binding semantics as
 * a wrapped mark:
 *
 * ```tsx
 * <ChartRaw spec={vg.axisFy({ anchor: "right", tickRotate: 45 })} />
 * ```
 */
export const ChartRaw = chartDescriptor<ChartRawProps>("ChartRaw", (props) =>
  Array.isArray(props.spec)
    ? props.spec.map((value: unknown) => ({ kind: "raw" as const, value }))
    : { kind: "raw", value: props.spec },
);
