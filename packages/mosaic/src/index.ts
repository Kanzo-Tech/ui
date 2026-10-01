/**
 * The Mosaic conversation, as one import, with no React in it.
 *
 * Reading a column out of an Arrow answer and publishing a clause are not user-interface concerns,
 * so they live here and both `@kanzo-tech/graph` and `@kanzo-tech/ui/analytics` depend on this
 * rather than on each other; the graph never pulls in vgplot. `@kanzo-tech/ui/analytics` re-exports
 * these names.
 *
 * The re-exports are deliberate: one import site for `Coordinator` and `Selection` makes one copy
 * of Mosaic the easy outcome, and two copies would be two crossfilters that never hear each other.
 */

export {
  Coordinator,
  MosaicClient,
  Selection,
  makeClient,
  clausePoint,
  clausePoints,
  clauseInterval,
  clauseIntervals,
  clauseMatch,
  type SelectionClause,
} from "@uwdata/mosaic-core";

export {
  Query,
  asc,
  desc,
  loadCSV,
  loadJSON,
  loadObjects,
  loadParquet,
  loadSpatial,
  loadExtension,
  type ExprValue,
  type FilterExpr,
} from "@uwdata/mosaic-sql";

/** Ours: turning an Arrow answer into values, which the client protocol does not do for you. */
export { column, numbers } from "./arrow.js";

/** Ours: what every `table` here and in the charts takes — one identifier, or a relation named in SQL. */
export { type TableExpr } from "./table.js";

/**
 * Ours: the page's one DuckDB-WASM engine — the coordinator and the file registry beside it. It is
 * the only door to `wasmConnector`, which is why that is no longer re-exported: a second boot is a
 * second database, and every host that wrote its own boot also wrote its own registry policy.
 */
export { engine, EngineError, type Engine } from "./engine.js";
