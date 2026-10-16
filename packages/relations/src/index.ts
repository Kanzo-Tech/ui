/**
 * **The library's one read-model of a graph's catalog** — `/docs/design/relations`.
 *
 * A graph, as the library reads it, is a `JoinGraph`; a relation is a root and a path of hops over
 * it; the page's crossfilter crosses a clause between relations along those joins. None of it draws or
 * runs anything, so it sits below the canvas and the charts, and `@kanzo-tech/ui/analytics`,
 * `@kanzo-tech/ai/data` and `@kanzo-tech/graph` depend on it downward. Mosaic is reached through
 * `@kanzo-tech/mosaic`, the one door; the engine is the host's `Queryable`.
 */

/**
 * A relation over a join graph — a root type and the hops taken from it, compiled to one `Query`, so a
 * joined relation is a `TableExpr` like any table. `relation.ts`.
 */
export {
  TEMPORAL_DATATYPES,
  relationColumns,
  relationHops,
  relationKey,
  relationQuery,
  type Hop,
  type JoinAnnotation,
  type JoinColumn,
  type JoinColumnStats,
  type JoinEdge,
  type JoinGraph,
  type JoinType,
  type Relation,
  type RelationColumn,
  type RelationHop,
} from "./relation.js";

/**
 * The page's one crossfilter across relations — Mosaic's crossfilter with a resolver that crosses a
 * clause published on one relation into a client of another, by key along the joins, or keeps none of
 * it where there is no way across; and the pre-aggregator kept to a client's own relation. The
 * resolver is also the one door to the joins: a relation's steps, the paths from a type, the relation
 * a set of paths lies on, and where a path off it is crossed in. `crossfilter.ts`.
 */
export {
  JoinResolver,
  crossfilterOver,
  onRelation,
  preaggregateOwnRelation,
  readOf,
  relationOf,
  sameRelation,
  type JoinField,
  type JoinMiss,
  type JoinStep,
  type RelationClient,
  type RelationExpr,
  type RelationRef,
} from "./crossfilter.js";

/**
 * A thing's words are its labels — its `rdfs:label` in the page's language, a type named by its naming
 * column, and the identifier split as the last resort, never inflected. `words.ts`.
 */
export { edgeWords, labelOf, namingColumn, splitWords, typeWords } from "./words.js";

/** What a mapping states that a catalog does not — labels, datatypes, term types — filled in. `mapping.ts`. */
export { withMapping, type MappingModel } from "./mapping.js";

/** The one way to make a `JoinGraph` from an engine, and the reader of an attached GraphAr graph. `graphar.ts`. */
export { readJoinGraph, type CatalogReader } from "./graphar.js";
