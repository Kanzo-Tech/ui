---
"@kanzo-tech/mosaic": minor
"@kanzo-tech/ui": minor
---

**`IdSetClient` and `IdSetClientOptions` are gone** from `@kanzo-tech/mosaic` and
`@kanzo-tech/ui/analytics`. To publish a set of ids into a `Selection`, call
`selection.update(clausePoints([column], ids.map((id) => [id]), { source }))` — `clausePoints` is
exported from both packages. To read the ids that survive the crossfilter, use `useChartQuery`.
