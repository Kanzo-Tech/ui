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
// its own with raw HTML; these are the same clauses wearing our FacetFilter / Input / Slider.
export { ChartFilter, ChartSearch, ChartSlider } from "./charts/chart-inputs.js";
export type {
  ChartFilterProps, ChartFilterOption, ChartSearchProps, ChartSliderProps,
} from "./charts/chart-inputs.js";
// The engine under those three, on its own. A control is a Mosaic input because it declares a query
// and publishes a clause carrying its own `source` — not because it looks like one of ours, so a
// surface we did not think of gets the same conversation instead of reimplementing it. Same move as
// `useChartQuery` below, and as the AI hooks on the root barrel.
export { useMosaicInput } from "./charts/chart-inputs.js";
export type { MosaicInputOptions, MosaicInputState } from "./charts/chart-inputs.js";

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

// Re-exported so a consumer writes a whole chart — and boots the coordinator under it — without a
// direct @uwdata import, the way `/table` re-exports its TanStack types.
//
// The list below is drawn on one rule, because the list it replaced was drawn on none: a set is
// re-exported when it is **closed and named**, and stays a direct import when it is open. vgplot's
// ~250 plot attributes and mosaic-sql's expression builders are open — `ChartRoot`'s `attributes`
// takes them raw, and taking them raw is what an escape hatch *is*, so `yRange([72, -18])` on a
// ridgeline still says `@uwdata/vgplot` and should. Four exports failed that rule and are gone:
// `coordinator` (vgplot's process-wide active-coordinator setter — `MosaicProvider` is the only
// thing that should ever call it), `Fixed` (a scale-domain sentinel for the open attribute set, and
// not even assignable to our own `ChartAxisY domain`), and `from` / `plot`, which claimed to
// complete the `ChartRaw` hatch and did not: no `ChartRaw` needs either, because `ChartRoot` already
// owns the `plot(...)` call and the mark's `data` / `filterBy` props already own the source. What a
// `ChartRaw` actually reaches for is one of the six axis marks below.

// Boot: the coordinator, its connector, and the loaders that put a relation in front of it. The
// "bring your own coordinator" recipe is four lines, and the fourth used to be a direct import.
export { Coordinator, Selection, wasmConnector } from "@uwdata/mosaic-core";
export {
  loadCSV, loadJSON, loadObjects, loadParquet, loadSpatial, loadExtension,
} from "@uwdata/mosaic-sql";

// Channels: what `x` / `y` / `r` take. The aggregate vocabulary is complete on purpose. `min`,
// `max`, `mode` and `stddev` are one line each and today nothing imports them — but a vocabulary
// with holes sends the author to `@uwdata` for the one aggregate we left out, which is precisely the
// import the rest of this barrel exists to remove, and there is no reading of "a chart author will
// never want a standard deviation" that survives contact with a chart author. Same argument that
// keeps the marks in `chart-marks.tsx` that no example draws.
export { count, sum, avg, min, max, median, quantile, stddev, mode, bin, sql } from "@uwdata/vgplot";
export type { ExprValue } from "@uwdata/mosaic-sql";

// The six marks the layer withholds on purpose, because axes here compile to plot *attributes* — an
// axis mark would steal the binding from the interactor after it. They are a closed set the docs
// enumerate twice, and they are what `ChartRaw` was built for: the measure scale repeated at the top
// of a long bar list is `axisX({ anchor: "top" })` and nothing else. Reach for `ChartAxisX` first;
// these six are for the second axis it cannot give you.
export { axisX, axisY, axisFx, axisFy, gridFx, gridFy } from "@uwdata/vgplot";

// Joining the crossfilter without being one of ours. Subclass `MosaicClient` (or wrap `makeClient`),
// declare a query, publish one of the five clauses — that is the entire protocol, and it is how a
// WebGL canvas or an imperative widget becomes a peer of the plots rather than a readout drifting
// beside them. Our own three DOM controls in `chart-inputs.tsx` are built from nothing else.
export {
  MosaicClient, makeClient,
  clausePoint, clausePoints, clauseInterval, clauseIntervals, clauseMatch,
} from "@uwdata/mosaic-core";
export type { SelectionClause } from "@uwdata/mosaic-core";
export type { FilterExpr } from "@uwdata/mosaic-sql";

// The other half of that protocol, and the half it does not give you. Declaring a query is small
// and publishing a clause is documented; turning the ANSWER into values is where every client
// independently writes `as { getChild(name: string): … }` — a cast asserting Arrow's shape rather
// than checking it, and wrong the first time the query selects a string. Arrow only offers a typed
// column when the type allows one, so the fallback is not a nicety.
export { column, numbers } from "./charts/arrow.js";

// And the client that protocol is usually reached for. A view whose positions are not in the
// database — a GPU canvas, a map, an imperative widget — cannot publish `weight BETWEEN …`, because
// there is no column to write the predicate over. It can only enumerate what was hit. That shape is
// the same every time: fade by the surviving ids, publish a points clause, and decline the
// self-exemption so the fade reads as the brush.
export { IdSetClient } from "./charts/id-set-client.js";
export type { IdSetClientOptions } from "./charts/id-set-client.js";

// The five preset charts (Histogram, BarChart, LineChart, ScatterPlot, BarSeriesChart) are gone —
// they were five parallel hardcoded `vg.plot(...)` calls that could not be composed. Each one is
// now a ten-line example in the docs, written with the grammar above.
