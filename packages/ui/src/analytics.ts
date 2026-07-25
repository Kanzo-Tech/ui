// @kanzo-tech/ui/analytics — a thin composable layer over Mosaic/vgplot.
//
// Named for the capability, not the engine, the way `/editor` is not `/codemirror` — and not
// `/charts`, because the subpath also holds the controls that filter them and the figures that
// read the same relation. The components stay `Chart*`: those are charts.
//
// Kept off the root barrel so the base bundle never carries the DuckDB/Mosaic analytics stack.
// `@uwdata/vgplot`, `@uwdata/mosaic-core`, `@uwdata/mosaic-sql` and `@duckdb/duckdb-wasm` are all
// **optional peer dependencies** — the package never imports DuckDB-WASM and never instantiates a
// Coordinator. The consumer builds one over their own backend (in a `"use client"` island) and
// passes it to `MosaicProvider`, which is what keeps DuckDB-WASM out of every Server Component.
//
// The layer is a grammar, not a set of chart types: `ChartRoot` compiles its inert descriptor
// children (marks, interactors, axes) into one `vg.plot(...)`, so a bar and a line share a plot and
// any interactor pairs with any mark. `ChartRaw` and the root's `attributes` are the escape hatches
// for the parts of vgplot the layer does not wrap — wrapping is a convenience, never a cage.
export { MosaicProvider, useMosaic, useCrossfilter, useSelected } from "./charts/mosaic-provider.js";
export type { MosaicProviderProps, MosaicContextValue } from "./charts/mosaic-provider.js";

export { ChartRoot, useChart, useChartOptional } from "./charts/chart-root.js";
export type { ChartRootProps, ChartContextValue } from "./charts/chart-root.js";

export type { ChartConfig, ChartSeriesConfig, ChartSeriesEntry } from "./charts/chart-config.js";
export { chartSeriesEntries, chartSeriesColor, isColorValue } from "./charts/chart-config.js";

// Marks. `ChartRaw` takes a `vg.*` directive the layer does not wrap, in source order.
export {
  ChartBarY, ChartBarX, ChartWaffleY, ChartWaffleX,
  ChartLine, ChartLineY, ChartLineX,
  ChartArea, ChartAreaY, ChartAreaX,
  ChartDot, ChartDotX, ChartDotY, ChartCircle, ChartHexagon, ChartImage,
  ChartRect, ChartRectY, ChartRectX,
  ChartCell, ChartCellX, ChartCellY,
  ChartRuleY, ChartRuleX, ChartTickX, ChartTickY,
  ChartText, ChartTextX, ChartTextY,
  ChartVector, ChartVectorX, ChartVectorY, ChartSpike, ChartArrow, ChartLink,
  ChartHeatmap, ChartRaster, ChartRasterTile, ChartContour, ChartDenseLine,
  ChartDensity, ChartDensityY, ChartDensityX, ChartHexbin, ChartRegressionY,
  ChartErrorbarY, ChartErrorbarX,
  ChartVoronoi, ChartVoronoiMesh, ChartDelaunayLink, ChartDelaunayMesh, ChartHull,
  ChartGeo, ChartSphere, ChartGraticule,
  ChartFrame, ChartGridX, ChartGridY, ChartHexgrid,
  ChartRaw,
} from "./charts/chart-marks.js";
export type { ChartMarkProps, ChartRawProps } from "./charts/chart-marks.js";

// Interactors — the crossfilter, as JSX. `ChartHighlight` reads a selection (`by`); the rest
// publish into one (`as`, defaulting to the root's).
export {
  ChartIntervalX, ChartIntervalY, ChartIntervalXY,
  ChartToggleX, ChartToggleY, ChartToggleColor,
  // The same six under names that describe the gesture in both cases: pick = click a category,
  // brush = drag a range. vgplot's spellings stay for anyone arriving from Mosaic's docs.
  ChartPickX, ChartPickY, ChartPickColor,
  ChartBrushX, ChartBrushY, ChartBrushXY,
  ChartNearestX, ChartNearestY,
  ChartRegion, ChartHighlight, ChartPanZoom,
} from "./charts/chart-interactors.js";
export type {
  ChartInteractorProps, ChartHighlightProps, ChartPanZoomProps,
} from "./charts/chart-interactors.js";

// Axes and facets are attributes, not marks — a facet-axis *mark* would steal the plot binding
// from the interactor after it. `fx`/`fy` themselves are ordinary channels on any mark.
export { ChartAxisX, ChartAxisY, ChartFacetX, ChartFacetY } from "./charts/chart-axes.js";
export type {
  ChartAxisXProps, ChartAxisYProps, ChartFacetXProps, ChartFacetYProps,
} from "./charts/chart-axes.js";

// Inputs: real DOM controls that publish into a `Selection` without being charts. vgplot renders
// its own with raw HTML; these are the same clauses wearing our Select / Input / Slider.
export { ChartMenu, ChartSearch, ChartSlider } from "./charts/chart-inputs.js";
export type {
  ChartMenuProps, ChartMenuOption, ChartSearchProps, ChartSliderProps,
} from "./charts/chart-inputs.js";

// `ChartLegend` is ours (DOM, reads the config); `ChartColorLegend` is vgplot's interactive one.
export { ChartLegend, ChartColorLegend } from "./charts/chart-legend.js";
export type { ChartLegendProps, ChartColorLegendProps } from "./charts/chart-legend.js";

// The connected half of the tile pair: `StatTile` (root barrel) takes a number, this one queries
// for it under the crossfilter. See "the engine rule" in DESIGN.md.
export { ChartStat } from "./charts/chart-stat.js";
export type { ChartStatProps } from "./charts/chart-stat.js";

// For anything that is not a plot but must still follow the brush — a KPI, a readout, a table.
export { useChartQuery, Query } from "./charts/use-chart-query.js";
export type { ChartQueryOptions, ChartQueryResult, ChartQueryRow } from "./charts/use-chart-query.js";
// `ChartCard` and `DashboardGrid` are gone: a titled frame and a responsive grid are arrangements
// with no behaviour, so per DESIGN.md's ladder they are copied, not imported. They live in
// `docs/lib/` for the showcases that use them.

// For a descriptor of your own: `chartDescriptor` mints one, the rest is the compiler's contract.
export {
  chartDescriptor, compileChartSpec, buildChartSpec, chartSpecSignature,
} from "./charts/chart-spec.js";
export type {
  ChartDescriptor, ChartCompile, ChartDirective, ChartMarkDirective, ChartInteractorDirective,
  ChartAttributeDirective, ChartLegendDirective, ChartRawDirective, ChartSpecContext,
  ChartSpecOptions, ChartMargin, ChartFacetOptions, ChartMarkSource,
} from "./charts/chart-spec.js";

// The validated categorical palette for multi-series marks and legends (fixed, not the accent).
export { CHART_CATEGORICAL, categoricalColor } from "./charts/theme.js";

// Re-exported so a consumer writes a whole chart without a direct @uwdata import, the way `/table`
// re-exports its TanStack types. Aggregates and `bin` are what the `y`/`x` channels take.
export { Coordinator, Selection, coordinator, wasmConnector } from "@uwdata/mosaic-core";
export {
  count, sum, avg, min, max, median, quantile, stddev, mode, bin, sql, Fixed,
} from "@uwdata/vgplot";

// `from` and `plot` complete the escape hatch: without them every `ChartRaw` forced a direct
// @uwdata import, which is exactly the dependency the rest of this barrel exists to avoid.
export { from, plot } from "@uwdata/vgplot";

// The five preset charts (Histogram, BarChart, LineChart, ScatterPlot, BarSeriesChart) are gone —
// they were five parallel hardcoded `vg.plot(...)` calls that could not be composed. Each one is
// now a ten-line example in the docs, written with the grammar above.
