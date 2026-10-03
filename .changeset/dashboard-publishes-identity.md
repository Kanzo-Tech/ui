---
"@kanzo-tech/mosaic": minor
"@kanzo-tech/ui": minor
---

**A relation dashboard and a graph share one crossfilter, in both directions.**

- `@kanzo-tech/mosaic`: `bridgeSelection(inner, outer, map)` joins a selection to another. Every clause of `outer` reaches `inner` as itself — Mosaic's `include` relay — and the clauses published into `inner` are mapped together, through `map`, into one clause of `outer` whose source is the bridge. Retracting either side retracts the other, and nothing that arrived from `outer` is mapped back out. Returns the unbridge. `ClauseMap` is the map's type.
- `@kanzo-tech/mosaic`: `semiJoinOf(key, table, { label })` is the map for a relation keyed by an identity: `key IN (SELECT key FROM table WHERE <every clause>)`.
- `@kanzo-tech/ui/analytics`: `Dashboard` takes `publish?: ClauseMap`. With it, the tiles crossfilter each other in a selection of the dashboard's own and the page gets the one clause `publish` maps them to; the page's clauses still reach every tile. Pass `publish={semiJoinOf(relationIdentities(graph, relation)[0].column, table)}` beside a graph: a brush on a tile greys out every vertex but the roots of the rows it keeps, instead of `graph/unfilterable`. Without `publish`, nothing changes. `semiJoinOf` and `ClauseMap` are re-exported from `/analytics`.
