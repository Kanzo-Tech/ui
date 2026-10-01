---
"@kanzo-tech/ui": minor
---

**`@kanzo-tech/ui/analytics` has a mini BI kit: `Dashboard`, and the parts it is made of.**

- `<Dashboard table value onChange />` draws a filter row, stat tiles, chart cards and a paged rows
  table over one relation, all on the provider's crossfilter. With no `value` it draws an automatic
  dashboard from the relation's field stats; every edit calls `onChange` with the whole
  `DashboardSpec`, plain JSON for the host to save. `exclude` hides bookkeeping columns, `config`
  gives a field drawn as series its own labels, colours and icons.
- The parts are exported too: `DashboardFilters`, `DashboardStat`, `ChartCard`, `DetailTable`, and
  `FilterChips` / `useClauses` for any selection. `useFieldStats` / `queryFieldStats` read a
  relation's fields (one `SUMMARIZE`); `autoDashboard(fields)` is the automatic spec.
- `useMosaic()` gains `retract(clauses)`: it clears those clauses on the selection each was
  published into, so removing a chip also clears the pick or brush that made it.
- If you copied the docs' `ChartCard`, `DashboardGrid` or `FilterChips` frames: the first two are
  `Card` parts and a grid class now, and `FilterChips` is the library's — import it from
  `@kanzo-tech/ui/analytics` (it has no `empty` prop; render your own hint while `useClauses` is
  empty).
