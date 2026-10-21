---
"@kanzo-tech/ui": minor
---

Dashboards read a `Pattern` over the page's graph.

- `MosaicProvider` takes `graph`, the `Graph` from `@kanzo-tech/graphar-duckdb`'s `attachGraph`, in
  place of `joins`; `useMosaic()` returns `graph` in place of `joins`.
- `Dashboard`, `FilterBar` and `RelationPicker` take a `Pattern` as `relation`/`value`:
  `[{ as: "person", type: "Person" }, { edge: "knows", direction: "out" }, { as: "friend", type: "Person" }]`.
  A chart's `relation` may also be a `Pattern`, or a `Relation` such as the graph view's `verticesOf(graph)`.
- A field is `variable.property` — `person.country`, `friend.country` — in every spec, filter, tile
  and `config` key. A count names a `variable` in place of a `path`.
- The stored document is `{ byPattern: { [patternKey(pattern)]: spec } }` in place of `byRelation`.
  A stored document of an earlier release is refused by `parseDashboards`; delete it and let the
  reader save again.
- `RelationPicker` takes the `Graph` and a `Pattern`, names every vertex it adds (`variableFor`), and
  its `phrase` receives graphar's `EdgeType`. Its sentences use the graph's names — *isPartOf → Place*,
  *Comment isLocatedIn → this Place* — with no words split out of them.
