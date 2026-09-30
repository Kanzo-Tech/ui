---
"@kanzo-tech/ui": minor
"@kanzo-tech/mosaic": minor
---

**Every `table` takes a relation in another catalog.** `ChartRoot`, a mark's `table`, `ChartStat`,
`ChartFilter`, `ChartSearch`, `ChartSlider` and `IdSetClient` now take a `TableExpr`: a string, as
before, or a mosaic-sql node, which goes into the SQL as written. A string still means one
identifier in the default catalog — `"Person"` is `FROM "Person"` — so nothing you pass today
changes. For a relation a backend names already qualified, such as a fossil corpus's
`relation.sql`, pass `verbatim(relation.sql)`; for a path you hold in parts,
`asTableRef([catalog, name])`. Both come from `@uwdata/mosaic-sql`, and `TableExpr` is on
`@kanzo-tech/ui/analytics` and `@kanzo-tech/mosaic`.

`useChartContext().table` is typed `TableExpr` to match: code that read it as a `string` narrows
it (`typeof table === "string"`) or passes it on to `Query.from`, which takes both.
