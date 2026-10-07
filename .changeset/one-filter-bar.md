---
"@kanzo-tech/ui": patch
---

The page has one row of filters, `FilterBar`, and a `Dashboard` draws its filters in it. Put
`<FilterBar table={…} rowNoun="…" />` under the page's header: it shows every clause on the page as a
removable chip, the dashboard's filter chips and **+ Filter**, the "12 of 40" readout and **Clear**.
The dashboard's filters stay in its saved spec and keep filtering the whole page through its
`publish` clause, and they stay on screen while the dashboard is hidden behind `MosaicClients`.

Breaking:

- `FilterChips` and `FilterChipsProps` are removed. Render `<FilterBar />`, which draws the same chips;
  `useClauses` is unchanged.
- `DashboardFilters` and `DashboardFiltersProps` are no longer exported. A `Dashboard` draws its
  filters in the page's `FilterBar`, and a page without one shows none.
- `Dashboard`'s `rowNoun` is removed. Pass it, with `table`, to `FilterBar`, which owns the readout now.
- *Add tile* and the dashboard's options menu sit in a row of their own above the tiles.
