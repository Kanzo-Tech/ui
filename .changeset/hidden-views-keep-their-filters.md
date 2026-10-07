---
"@kanzo-tech/ui": patch
"@kanzo-tech/mosaic": patch
---

A view you hide can keep its filters. Wrap it in the new `MosaicClients enabled={false}` (from
`@kanzo-tech/ui/analytics`) and hide it instead of unmounting it: its charts, inputs and
`useChartQuery` stop querying but keep their brushes and clauses, and catch up when enabled again.

`FilterChips` now shows a dashboard's bridged clause as one chip per tile filter, such as
*Dashboard country Spain*, and removing one removes that filter alone. `@kanzo-tech/mosaic` adds
`bridged(clause)`, which returns the inner clauses a bridge mapped and retracts one of them.
