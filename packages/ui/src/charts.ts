// @kanzo-tech/ui/charts — tokenized Mosaic/vgplot crossfilter charts.
//
// Kept off the root barrel so the base bundle never carries the DuckDB/Mosaic analytics stack.
// Consumers: `import { MosaicProvider, Histogram, BarChart } from "@kanzo-tech/ui/charts"`.
//
// This subpath mirrors the CodeEditor pattern, not an Ark machine: vgplot is wrapped and
// tokenized the way CodeEditor themes CodeMirror, and it is **bring-your-own-coordinator** the
// way CodeEditor is bring-your-own-language. `@uwdata/vgplot`, `@uwdata/mosaic-core`,
// `@uwdata/mosaic-sql` and `@duckdb/duckdb-wasm` are all **optional peer dependencies** — the
// package never imports DuckDB-WASM and never instantiates a Coordinator. The consumer builds
// the coordinator over their own backend (in a `"use client"` island) and passes it to
// `MosaicProvider`, which is what keeps DuckDB-WASM out of every React Server Component.
export { MosaicProvider, useMosaic, useCrossfilter } from "./charts/mosaic-provider.js";
export type { MosaicProviderProps, MosaicContextValue } from "./charts/mosaic-provider.js";

export { Histogram } from "./charts/histogram.js";
export type { HistogramProps } from "./charts/histogram.js";
export { BarChart } from "./charts/bar-chart.js";
export type { BarChartProps } from "./charts/bar-chart.js";

// Re-exported so a consumer wires a coordinator + crossfilter without a direct @uwdata import,
// the way `/table` re-exports its TanStack types.
export { Coordinator, Selection, coordinator, wasmConnector } from "@uwdata/mosaic-core";
