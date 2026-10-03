// @kanzo-tech/ui/analytics — a thin composable layer over Mosaic/vgplot.
//
// Named for the capability, not the engine, the way `/editor` is not `/codemirror` — and not
// `/charts`, because the subpath also holds the controls that filter them and the figures that
// read the same relation. The components stay `Chart*`: those are charts.
//
// Kept off the root barrel so the base bundle never carries the DuckDB/Mosaic analytics stack.
// `@uwdata/vgplot`, `@uwdata/mosaic-plot`, `@uwdata/mosaic-core` and `@uwdata/mosaic-sql` are **optional peer
// dependencies**; DuckDB-WASM arrives with `@kanzo-tech/mosaic`, whose `engine()` is re-exported here.
// No chart instantiates a Coordinator: the consumer takes one (in a `"use client"` island) and passes
// it to `MosaicProvider`, which is what keeps DuckDB-WASM out of every Server Component.
//
// The layer is a grammar, not a set of chart types: `ChartRoot` compiles its inert descriptor
// children (marks, interactors, axes) into one `vg.plot(...)`, so a bar and a line share a plot and
// any interactor pairs with any mark. `ChartRaw` and the root's `attributes` are the escape hatches
// for the parts of vgplot the layer does not wrap — wrapping is a convenience, never a cage.
export { MosaicProvider, useMosaic, useCrossfilter, useSelected } from "./charts/mosaic-provider.js";
export type { MosaicProviderProps, MosaicContextValue } from "./charts/mosaic-provider.js";

export { ChartRoot, useChartContext, useChartContextOptional } from "./charts/chart-root.js";
export type { ChartRootProps, ChartContextValue } from "./charts/chart-root.js";

export type { ChartConfig, ChartSeriesConfig, ChartSeriesEntry } from "./charts/chart-config.js";
// No `chartSeriesEntries` (the config→rows projection `ChartLegend` renders) and no `isColorValue`,
// whose sibling predicate `isColorToken` was already correctly internal — an inconsistent seam.
export { chartSeriesColor } from "./charts/chart-config.js";

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

// The connected half of the stat pair, which is the engine rule: `StatValue` (root barrel) takes
// a number, this one queries for it under the crossfilter.
export { ChartStat } from "./charts/chart-stat.js";
export type { ChartStatProps } from "./charts/chart-stat.js";

// For anything that is not a plot but must still follow the brush — a KPI, a readout, a table.
export { useChartQuery, Query } from "./charts/use-chart-query.js";
// A statement read once and suspended on — a catalog, a schema — outside the crossfilter.
export { useQueryRows } from "./charts/use-query-rows.js";
export type { ChartQueryOptions, ChartQueryResult, ChartQueryRow } from "./charts/use-chart-query.js";
// What a selection holds, as chips that retract a clause where it was published.
export { FilterChips, useClauses } from "./charts/filter-chips.js";
export type { FilterChipsProps } from "./charts/filter-chips.js";

// The mini BI kit: a relation's fields from one `SUMMARIZE`, and a dashboard as serializable data —
// a filter row, tiles, chart cards and a rows table, each chosen and edited from those fields.
// `Dashboard` is the whole thing; the four parts are what it is made of, for a host arranging its
// own. A titled frame is `Card` and a grid is a class list, so neither is a name of its own.
export { Dashboard } from "./charts/dashboard.js";
export type { DashboardProps } from "./charts/dashboard.js";
export { DashboardFilters } from "./charts/dashboard-filters.js";
export type { DashboardFiltersProps } from "./charts/dashboard-filters.js";
export { DashboardStat } from "./charts/dashboard-stat.js";
export type { DashboardStatProps } from "./charts/dashboard-stat.js";
export { ChartCard } from "./charts/chart-card.js";
export type { ChartCardProps } from "./charts/chart-card.js";
export { DetailTable } from "./charts/detail-table.js";
export type { DetailTableProps } from "./charts/detail-table.js";
export { autoDashboard, plotRelation } from "./charts/dashboard-spec.js";
export type {
  DashboardSpec, DashboardCardSpec, DashboardStatSpec, DashboardFilterSpec, DashboardMeasure,
  DashboardChartType, DashboardAggregate,
} from "./charts/dashboard-spec.js";
export { recommend } from "./charts/recommend.js";
export type { Recommendation, RecommendIntent } from "./charts/recommend.js";
export { useFieldStats, queryFieldStats, fieldStats } from "./charts/field-stats.js";
export type {
  FieldStat, FieldStats, FieldKind, FieldRole, FieldStatsOptions, FieldStatsState, SummarizeRow,
} from "./charts/field-stats.js";

// For a descriptor of your own: `chartDescriptor` mints one, and the types below are the contract
// it compiles into. `compileChartSpec` / `buildChartSpec` / `chartSpecSignature` are NOT here —
// they are the compiler `ChartRoot` runs, with no consumer outside `charts/`, and a descriptor
// author never calls them. Publishing the compiler alongside the thing you write for it is how a
// grammar's internals become somebody's API.
export { chartDescriptor } from "./charts/chart-spec.js";
export type {
  ChartDescriptor, ChartCompile, ChartDirective, ChartMarkDirective, ChartInteractorDirective,
  ChartAttributeDirective, ChartRawDirective, ChartSpecContext,
  ChartSpecOptions, ChartMargin, ChartFacetOptions, ChartMarkSource,
} from "./charts/chart-spec.js";

// The categorical scheme, `resolveTokenColor` and `useThemeTick` are on the ROOT barrel, not here.
// They import no engine, and a part belongs on a subpath only if it imports that subpath's engine:
// a WebGL canvas painting from `--chart-*` was installing DuckDB and Mosaic to reach twelve lines
// of token arithmetic. They live in `lib/token-color.ts` and `lib/theme-tick.ts`.

// Re-exported so a consumer writes a whole chart — and boots the coordinator under it — without a
// direct @uwdata import, the way `/table` re-exports its TanStack types.
//
// The data half comes from `@kanzo-tech/mosaic`, which owns it; the plotting half is what this
// subpath is.
//
// The list below is drawn on one rule: a set is
// re-exported when it is **closed and named**, and stays a direct import when it is open. vgplot's
// ~250 plot attributes and mosaic-sql's expression builders are open — `ChartRoot`'s `attributes`
// takes them raw, and taking them raw is what an escape hatch *is*, so `yRange([72, -18])` on a
// ridgeline still says `@uwdata/vgplot` and should.
// vgplot's `coordinator` setter is not re-exported: `MosaicProvider` is the only thing that should
// call it.

// Boot: the page's one engine, and the loaders that put a relation in front of it. `Coordinator`
// stays for a host that brings a connector of its own; the DuckDB-WASM one is `engine()`, because a
// second boot on the page is a second database the last-mounted chart wins.
export { Coordinator, Selection, engine, type Engine } from "@kanzo-tech/mosaic";
export {
  loadCSV, loadJSON, loadObjects, loadParquet, loadSpatial, loadExtension,
} from "@kanzo-tech/mosaic";

// Channels: what `x` / `y` / `r` take. The aggregate vocabulary is complete on purpose. `min`,
// `max`, `mode` and `stddev` are one line each and today nothing imports them — but a vocabulary
// with holes sends the author to `@uwdata` for the one aggregate we left out, which is precisely the
// import the rest of this barrel exists to remove, and there is no reading of "a chart author will
// never want a standard deviation" that survives contact with a chart author. Same argument that
// keeps the marks in `chart-marks.tsx` that no example draws.
export { count, sum, avg, min, max, median, quantile, stddev, mode, bin, sql } from "@uwdata/vgplot";
export type { ExprValue } from "@kanzo-tech/mosaic";
// What every `table` prop takes: a string is one identifier, a mosaic-sql node is a relation named
// in SQL — a catalog-qualified one, as a fossil corpus hands it over.
export type { TableExpr } from "@kanzo-tech/mosaic";

// Ordering, for the builder that is already on this barrel. `Query…orderby(col)` takes a bare
// column and sorts ascending; there is no second argument, so any other direction is `desc(col)`
// and nothing else. A host that took `Query` from here was still opening `@uwdata/mosaic-sql` for
// that one function — the same vocabulary with a hole in it the aggregates above are complete to
// avoid, and a plainer one, because the method that accepts them was exported and the argument it
// accepts was not. Two names is a closed set: it is the whole of ordering.
//
// No type comes with them. `ExprValue` is what they take and it is on the line above; what they
// return goes straight into `.orderby()`, so nothing makes a consumer spell its name — `FilterExpr`
// is here because `useChartQuery`'s `query` signature does. What would reverse that: a consumer
// who has to name it, a helper handing a sort spec back to its caller, at which point `OrderByNode`
// follows the same rule in the other direction.
export { asc, desc } from "@kanzo-tech/mosaic";

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
} from "@kanzo-tech/mosaic";
export type { SelectionClause, FilterExpr } from "@kanzo-tech/mosaic";

// The other half of that protocol, and the half it does not give you. Declaring a query is small
// and publishing a clause is documented; turning the ANSWER into values is where every client
// independently writes `as { getChild(name: string): … }` — a cast asserting Arrow's shape rather
// than checking it, and wrong the first time the query selects a string. Arrow only offers a typed
// column when the type allows one, so the fallback is not a nicety.
export { column, numbers } from "@kanzo-tech/mosaic";
// And what a failed query threw: a client's `queryError` is handed mosaic-core's `QueryError`, the
// original one level down, and a host keying on its `code` needs that original back.
export { queryFailure } from "@kanzo-tech/mosaic";

// The five preset charts (Histogram, BarChart, LineChart, ScatterPlot, BarSeriesChart) are gone —
// they were five parallel hardcoded `vg.plot(...)` calls that could not be composed. Each one is
// now a ten-line example in the docs, written with the grammar above.
