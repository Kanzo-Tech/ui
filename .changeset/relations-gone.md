---
"@kanzo-tech/mosaic": minor
"@kanzo-tech/ui": minor
---

`@kanzo-tech/relations` is deleted; uninstall it. A page reads its graph through
`@kanzo-tech/graphar-duckdb`: `attachGraph` answers a `Graph`, and that `Graph` is what every part takes.

- `readJoinGraph`, `withMapping`, `JoinGraph`, `JoinResolver`, `relationQuery`, `relationKey`,
  `relationHops`, `relationColumns`, `labelOf`, `typeWords`, `edgeWords` and `splitWords` have no
  replacement: the `Graph` describes the types, edges and properties, and a `Pattern` is the relation.
- The page's crossfilter is `@kanzo-tech/mosaic`'s: `crossfilterOver(graph)`, `relationOver(graph,
  pattern)`, `patternKey(pattern)`, `onRelation`, `relationOf`, `sameRelation` and
  `preaggregateOwnRelation`. A clause on one relation reaches a part on another landed on the vertex
  of the same type it holds, or along the graph's one shortest path; where there is no path, or two
  of one length, it keeps none of that part's rows.
- The `relations/invalid`, `relations/unmatched` and `relations/no-step` codes are gone. A pattern the
  graph cannot match throws graphar's `GraphArError`.
- The RML mapping is no longer read: a year the mapping typed `xsd:gYear` and the writer stored as an
  integer is a number, and a type, an edge and a field are called by their names.
