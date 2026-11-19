---
"@kanzo-tech/ui": minor
---

`useFieldStats(pattern, options)` reads what the page's `Graph` says of each property and queries
nothing: it returns `{ fields, columns }` at once, and throws where the provider has no `graph`.
`FieldStatsState`, its `error`, and the `SUMMARIZE` a relation was read with are gone.
`fieldStats(described)` takes `{ name, type, primary?, stats? }` columns and returns the fields;
`patternColumns(graph, pattern)` describes a pattern's columns. `FieldStat` has no `values`,
`annotations` or `label`; `distinct` is the count the chunks state, the least they allow where they
only bound it, or `0`. A field whose chunks state no count therefore reads `0`: it is never offered
as a series or a panel, and a number of that kind is grouped by its own values, never binned. A field
is an identifier only when it is its type's primary key.

`@tanstack/react-query` is no longer a peer of `@kanzo-tech/ui`: the dashboard reads nothing through
it. Keep it only if `@kanzo-tech/ai/data` or your own code uses it. `@kanzo-tech/graphar-duckdb` is a
new optional peer, for `/analytics` alone: install it beside `@kanzo-tech/mosaic` if you import
`/analytics`.
