// @kanzo-tech/ui/analytics — a thin composable layer over Mosaic/vgplot.
//
// Named for the capability, not the engine, the way `/editor` is not `/codemirror` — and not
// `/charts`, because the subpath also holds the controls that filter them and the figures that
// read the same relation. The components stay `Chart*`: those are charts.
//
// Kept off the root barrel so the base bundle never carries the DuckDB/Mosaic analytics stack.
// `@kanzo-tech/mosaic`, `@uwdata/vgplot`, `@uwdata/mosaic-plot` and `valibot` are **optional peer
// dependencies**; mosaic-core, mosaic-sql and DuckDB-WASM arrive with `@kanzo-tech/mosaic`, which is
// the one door to them (below). No chart boots an engine or holds a Coordinator: the consumer asks
// `engine()` (in a `"use client"` island) and passes it to `MosaicProvider`, which is what keeps
// DuckDB-WASM out of every Server Component; the coordinator is the engine's, never a host's.
//
// The layer is a grammar, not a set of chart types: `ChartRoot` compiles its inert descriptor
// children (marks, interactors, axes) into one `vg.plot(...)`, so a bar and a line share a plot and
// any interactor pairs with any mark. `ChartRaw` and the root's `attributes` are the escape hatches
// for the parts of vgplot the layer does not wrap — wrapping is a convenience, never a cage.
export { MosaicClients, MosaicProvider, useMosaic } from "./charts/mosaic-provider.js";
export type { MosaicClientsProps, MosaicProviderProps, MosaicContextValue } from "./charts/mosaic-provider.js";

export { ChartRoot, useChartContext, useChartContextOptional } from "./charts/chart-root.js";
export type { ChartRootProps, ChartContextValue, ChartPlot } from "./charts/chart-root.js";
export { ChartTimeline, type ChartTimelineProps } from "./charts/chart-timeline.js";

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
// publish into one (`as`, defaulting to the root's). Each is vgplot's name, and only that: the
// gesture names `ChartPick*` and `ChartBrush*` were aliases, and went (`/docs/design/analytics`).
export {
  ChartIntervalX, ChartIntervalY, ChartIntervalXY,
  ChartToggleX, ChartToggleY, ChartToggleColor,
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
  ChartFilterProps, ChartSearchProps, ChartSliderProps,
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
export { useChartQuery } from "./charts/use-chart-query.js";
// A statement read once and suspended on — a catalog, a schema — outside the crossfilter.
export { useQueryRows } from "./charts/use-query-rows.js";
export type { ChartQueryOptions, ChartQueryResult, ChartQueryRow } from "./charts/use-chart-query.js";
// The page's one row of filters: every clause as a chip that retracts it where it is held, a slot a
// dashboard draws its filters in, the readout and Clear.
export { FilterBar, useClauses } from "./charts/filter-bar.js";
export type { FilterBarProps } from "./charts/filter-bar.js";

// The mini BI kit: a relation's fields from what its data says of them, and a dashboard as serializable data —
// filters drawn in the page's `FilterBar` and tiles (figures, charts, tables), each chosen and edited from those fields.
// `Dashboard` is the whole thing; the parts are what it is made of, for a host arranging its own,
// and `TileEditor` is the one panel a tile is added and edited in, drawn in the page's `TileEditorAside`,
// which the host shows while `useTileEditorOpen` says a tile is edited. A titled frame is `Card` and a
// grid is a class list, so neither is a name of its own.
export { Dashboard } from "./charts/dashboard.js";
export type { DashboardProps } from "./charts/dashboard.js";
export { DashboardStat } from "./charts/dashboard-stat.js";
export type { DashboardStatProps } from "./charts/dashboard-stat.js";
export { ChartCard } from "./charts/chart-card.js";
export type { ChartCardProps } from "./charts/chart-card.js";
export { DetailTable } from "./charts/detail-table.js";
export type { DetailTableProps } from "./charts/detail-table.js";
export { TileEditor } from "./charts/tile-editor.js";
export { TileEditorAside, useTileEditorOpen } from "./charts/mosaic-provider.js";
export type { TileEditorProps } from "./charts/tile-editor.js";
export { TileView } from "./charts/tile-views.js";
export type { TileViewProps } from "./charts/tile-views.js";
export { autoDashboard, plotRelation } from "./charts/dashboard-spec.js";
// What a tile compiles with, for a reader of a tile that is not a dashboard's — `@kanzo-tech/ai/data`'s
// answers: the closed sets the spec's schema picks from, and the one compiler of a tile to its queries.
export { DASHBOARD_AGGREGATES, DASHBOARD_CHART_TYPES, TILE_ROWS, tileQuery } from "./charts/dashboard-spec.js";
export type {
  DashboardSpec, Tile, TileKind, TileSpan, StatTile, ChartTile, TableTile, DashboardFilterSpec,
  DashboardMeasure, DashboardChartType, DashboardAggregate, Condition, ConditionValue, TileContext, TileQuery,
} from "./charts/dashboard-spec.js";
// What a host keeps: every dashboard by the relation it is drawn over, and the one way back in for
// what it stored — checked against the spec's schema, refused whole when it is not current.
export { parseDashboards, parseTile } from "./charts/dashboard-spec.js";
export type { Dashboards } from "./charts/dashboard-spec.js";

// The picker that walks a pattern over the page's graph. The graph is `@kanzo-tech/graphar-duckdb`'s
// `Graph`, handed to `MosaicProvider` as its `graph`; a pattern is its `Pattern`. What every part's
// `relation` takes is `RelationExpr`: a table — by name, or any SQL Mosaic can read from — or a
// `Pattern` over the graph, whose fields are `variable.property`.
export type { RelationExpr } from "./charts/mosaic-provider.js";
export { RelationPicker } from "./charts/relation-picker.js";
export type { RelationPickerProps, RelationPickerTranslations } from "./charts/relation-picker.js";
export { useFieldStats, fieldStats, patternColumns } from "./charts/field-stats.js";
export type {
  FieldColumn, FieldStat, FieldStats, FieldKind, FieldRole, FieldStatsOptions,
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

// **Mosaic itself is not here.** The coordinator, the selections, the clients and clauses, the
// engine, the loaders, the relation algebra, `Query`, the aggregates, `sql`, `asc` and `desc` are
// `@kanzo-tech/mosaic`'s, and a host imports them from there: one door per idea, and the reason that
// package exists — one copy of Mosaic, so one coordinator. This barrel re-exported about forty-five
// of them, so the same name had two doors and keasy imported one name from both
// (`/docs/design/analytics`). What would reverse it: nothing on this side — a Mosaic name a host
// needs and cannot reach is added to `@kanzo-tech/mosaic`, and still not here.
//
// What stays is the plotting half, which is this subpath's: `bin`, made once per field and options
// so a re-render is not a new plot, and the six axis marks below. vgplot's `coordinator` setter is
// not here either: `MosaicProvider` is the only thing that should call it.
export { bin } from "./charts/chart-bin.js";

// The six marks the layer withholds on purpose, because axes here compile to plot *attributes* — an
// axis mark would steal the binding from the interactor after it. They are a closed set the docs
// enumerate twice, and they are what `ChartRaw` was built for: the measure scale repeated at the top
// of a long bar list is `axisX({ anchor: "top" })` and nothing else. Reach for `ChartAxisX` first;
// these six are for the second axis it cannot give you.
export { axisX, axisY, axisFx, axisFy, gridFx, gridFy } from "@uwdata/vgplot";

// The five preset charts (Histogram, BarChart, LineChart, ScatterPlot, BarSeriesChart) are gone —
// they were five parallel hardcoded `vg.plot(...)` calls that could not be composed. Each one is
// now a ten-line example in the docs, written with the grammar above.
