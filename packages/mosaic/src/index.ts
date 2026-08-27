/**
 * The Mosaic conversation, as one import.
 *
 * This package exists because of a bug that shipped. `@kanzo-tech/graph/duckdb` reached its
 * coordinator, clients and clauses through `@kanzo-tech/ui/analytics`, whose barrel re-exports the
 * React charts first — and `@uwdata/vgplot` with them. The import is static, so a host that
 * installed the two peers the documentation asked for, `mosaic-core` and `mosaic-sql`, still could
 * not open the subpath: vgplot came along, unasked and unused. `@kanzo-tech/graph` ended up
 * declaring vgplot as an optional peer to paper over a dependency it never names.
 *
 * The cause was a layer in the wrong package rather than a missing entry in a list. Reading a
 * column out of an Arrow answer and publishing a points clause are not user-interface concerns;
 * they were only in a component library because that is where the first chart needed them.
 *
 * So: the data half lives here, with no React anywhere in it, and both consumers depend on this
 * rather than on each other. `@kanzo-tech/ui/analytics` keeps every chart and re-exports these
 * names unchanged, so nothing on that surface moves.
 *
 * The re-exports below are deliberate rather than lazy. A single import site for `Coordinator` and
 * `Selection` is what makes one copy of Mosaic the easy outcome, and two copies would be two
 * crossfilters that never hear each other.
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
  wasmConnector,
  type SelectionClause,
} from "@uwdata/mosaic-core";

export {
  Query,
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
export { column, fillColumn, numbers, type NumericArray } from "./arrow.js";

/** Ours: the crossfilter adapter for a view whose positions are not in the database. */
export { IdSetClient, type IdSetClientOptions } from "./id-set-client.js";
