---
"@kanzo-tech/relations": minor
"@kanzo-tech/mosaic": minor
"@kanzo-tech/graph": minor
"@kanzo-tech/ui": patch
"@kanzo-tech/ai": patch
---

New package `@kanzo-tech/relations`. Install it beside `@kanzo-tech/mosaic` (its required peer) and
import these names from it, not from `@kanzo-tech/mosaic`: `JoinGraph`, `JoinType`, `JoinEdge`,
`JoinColumn`, `JoinColumnStats`, `JoinAnnotation`, `Relation`, `Hop`, `RelationColumn`,
`RelationHop`, `relationQuery`, `relationColumns`, `relationHops`, `relationKey`, `JoinResolver`,
`crossfilterOver`, `onRelation`, `relationOf`, `sameRelation`, `readOf`, `preaggregateOwnRelation`,
`JoinField`, `JoinMiss`, `JoinStep`, `RelationClient`, `RelationExpr`, `RelationRef`, `labelOf`,
`namingColumn`, `splitWords`, `typeWords`, `edgeWords`, `withMapping` and `MappingModel`.
`@kanzo-tech/mosaic` no longer exports them.

`readJoinGraph` is `@kanzo-tech/relations`'s, not `@kanzo-tech/graph`'s, and takes an engine, the
attached graph's name and a signal: `readJoinGraph(coordinator, "archive")` becomes
`readJoinGraph(engine, "archive", { signal })`, where `engine` is anything with
`query(sql, { signal })` — the page's `engine()` is one. The graph it answers is the same.
`CatalogReader` is the type of such a reader.

If you use `@kanzo-tech/ui/analytics`, `@kanzo-tech/ai/data` or `@kanzo-tech/graph`, add
`@kanzo-tech/relations` to your dependencies.
