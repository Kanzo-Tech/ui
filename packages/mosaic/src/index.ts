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

/**
 * The expression builders the graph writes its statements with — the ones it uses, and no more. A
 * statement built from nodes quotes its own identifiers and literals, which a search a reader types
 * must never leave to a template string. mosaic-sql's `column` is not among them: `column` here is
 * the Arrow reader below, and a bare string is already a column wherever these take one.
 */
export {
  asTableRef,
  cast,
  count,
  eq,
  float64,
  isIn,
  length,
  literal,
  sql,
  type ExprNode,
} from "@uwdata/mosaic-sql";

/**
 * Ours: the clause rule — column predicates on one relation, or a semi-join on identity — with the
 * constructor of the second form and the reading of the columns either names. `clause.ts` states it.
 */
export {
  clauseColumns,
  clauseSemiJoin,
  type SemiJoinMembers,
  type SemiJoinMetadata,
  type SemiJoinOptions,
} from "./clause.js";

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

/** Ours: what a query threw, from the `QueryError` mosaic-core hands a client's `queryError`. */
export { queryFailure } from "./failure.js";
