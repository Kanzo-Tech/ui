/**
 * The Mosaic conversation, as one import, with no React in it.
 *
 * Reading a column out of an Arrow answer and publishing a clause are not user-interface concerns,
 * so they live here and both `@kanzo-tech/graph` and `@kanzo-tech/ui/analytics` depend on this
 * rather than on each other; the graph never pulls in vgplot.
 *
 * **This is the one door to Mosaic.** `@kanzo-tech/ui`'s charts, `@kanzo-tech/graph` and
 * `@kanzo-tech/ai` import mosaic-core and mosaic-sql through it and nothing else, and
 * `@kanzo-tech/ui/analytics` re-exports none of it, so a host writes each name one way
 * (`/docs/design/analytics`). The re-exports are deliberate: one import site for `Coordinator` and
 * `Selection` makes one copy of Mosaic the easy outcome, and two copies would be two crossfilters
 * that never hear each other. What would reverse it: a Mosaic name a host or a chart needs that is
 * not here — then it is added here, and nowhere else.
 */

export {
  Coordinator,
  MosaicClient,
  Selection,
  makeClient,
  jsType,
  clausePoint,
  clausePoints,
  clauseInterval,
  clauseIntervals,
  clauseMatch,
  type ClauseSource,
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
 * The expression builders the graph, the charts and Ask write their statements with — the ones they
 * use, and no more. A statement built from nodes quotes its own identifiers and literals, which a
 * search a reader types must never leave to a template string. mosaic-sql's `column` is not among
 * them: a bare string is already a column wherever these take one.
 */
export {
  and,
  asTableRef,
  binDate,
  binHistogram,
  cast,
  cte,
  div,
  eq,
  float64,
  isAggregateExpression,
  isIn,
  isNotNull,
  length,
  literal,
  mul,
  not,
  sql,
  verbatim,
  type ExprNode,
} from "@uwdata/mosaic-sql";

/**
 * The aggregates, complete on purpose: what a chart's `x` / `y` / `r` and a `Query`'s `select` take.
 * A vocabulary with holes sends its author to `@uwdata` for the one left out, which is the import
 * this package exists to remove. They are mosaic-sql's, the same functions vgplot re-exports.
 */
export { avg, count, max, median, min, mode, quantile, stddev, sum } from "@uwdata/mosaic-sql";

/**
 * Ours: the clause rule — column predicates on one relation, or a semi-join on identity — with the
 * constructor of the second form, the reading of the columns either names, and what a clause says
 * to a person (`clauseParts`, `clauseLabel`) — read by `@kanzo-tech/ui`'s chips and filter bar.
 * `clause.ts` states it.
 */
export {
  clauseColumns,
  clauseAntiJoin,
  clauseSemiJoin,
  clauseParts,
  clauseLabel,
  type SemiJoinMembers,
  type SemiJoinMetadata,
  type SemiJoinOptions,
} from "./clause.js";

/**
 * Ours: the page's one crossfilter across relations — Mosaic's crossfilter with a resolver that
 * crosses a clause published on one relation into a client of another, by key along the joins, or
 * keeps none of it where there is no way across; and the pre-aggregator kept to a client's own
 * relation. `crossfilter.ts`.
 */
export {
  JoinResolver,
  crossfilterOver,
  onRelation,
  preaggregateOwnRelation,
  readOf,
  relationOf,
  sameRelation,
  type RelationClient,
  type RelationExpr,
  type RelationRef,
} from "./crossfilter.js";
/** Ours: what a page has yet to draw for the first time, counted on its selection — `drawing.ts`. */
export { firstDrawsPending, holdFirstDraw, onFirstDraws } from "./drawing.js";
/**
 * Ours: one selection's clauses relayed into another built earlier, as the clause objects
 * themselves — what Mosaic's `include` does at construction, after it: `relay.ts`.
 */
export { relaySelection } from "./relay.js";

/** Ours: turning an Arrow answer into values, which the client protocol does not do for you. */
export { numbers } from "./arrow.js";

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

/**
 * Ours: a relation over a join graph — a root type and the hops taken from it, compiled to one
 * `Query`, so a joined relation is a `TableExpr` like any table. The graph is data a reader builds
 * from its own catalog; `@kanzo-tech/graph`'s `readJoinGraph` builds one from a fossil corpus.
 */
export {
  relationHops,
  relationIdentities,
  relationKey,
  relationQuery,
  relationRootKey,
  relationSteps,
  type Hop,
  type JoinEdge,
  type JoinGraph,
  type JoinType,
  type Relation,
  type RelationHop,
} from "./relation.js";

/**
 * Ours: the relation a question needs, computed — the shortest path from the type it counts that
 * covers the types its fields are on and reaches the page's clauses, or the tie, or what is out of
 * reach. `resolve.ts`.
 */
export { resolveRelation, type RelationNeeds, type Resolved } from "./resolve.js";
