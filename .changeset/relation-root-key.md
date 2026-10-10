---
"@kanzo-tech/mosaic": patch
"@kanzo-tech/ui": patch
"@kanzo-tech/graph": patch
---

**A relation's root key, by name.** `relationRootKey(graph, relation)` in `@kanzo-tech/mosaic`, and
re-exported from `@kanzo-tech/ui/analytics`, is the column a relation publishes to the page through
— the root type's own `key`, the one column of a relation that is not prefixed. Where a host wrote
`relationIdentities(graph, relation)[0].column`, write
`semiJoinOf(relationRootKey(graph, relation), table, { label })`; `relationIdentities` is unchanged.

`@kanzo-tech/graph`'s README describes the search as it is — it asks the corpus once per pause in
typing, under the rest of the crossfilter — and lists `readJoinGraph`, `GraphTimeline` and `usePick`.
