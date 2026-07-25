---
"@kanzo-tech/ui": minor
---

**`/table` gains the headless hook and the parts the monolith hid; `DataTable` stays as the preset.**

`DataTable`'s props are unchanged, so every call site keeps working — it is now a twenty-line
preset composed from the parts below, which is the point: what it does not expose is no longer
unreachable.

`useDataTable` owns the engine — six row models wired (core, sorted, filtered, paginated, faceted,
faceted-unique), the state slices, `getRowId`, and the server-side modes (`manualPagination`,
`manualSorting`, `manualFiltering` + `rowCount`); anything else passes straight through to
`useReactTable`, and a caller's `onXChange` is chained after the internal setState rather than
replacing it.

The parts: `DataTableRoot` (+ `useDataTableContext`), `DataTableToolbar`, `DataTableSearch`
(per-column or global), `DataTableFacetFilter` (multi-select with counts, over Ark's `Menu` so
roving focus, typeahead and `menuitemcheckbox` come from the machine), `DataTableViewOptions`
(column visibility), `DataTableContent`, `DataTablePagination` (optional page-size selector and
selected-row count) and `selectColumn()` for the checkbox column.

Two sharp edges, both documented and both covered by tests. A column filtered by
`DataTableFacetFilter` must declare `filterFn: facetFilterFn` — TanStack's `arrIncludesSome`
expects the *cell* to be the array and degrades to substring matching on a scalar, so a filter for
`"active"` would also match `"inactive"`. And the context value is **deliberately not memoised**:
TanStack keeps one mutable table instance, so a memoised context freezes any part passed as
`children` at stale state.

Rows with `onRowClick` are now keyboard-reachable (Enter/Space, ignored when the key lands on a
control inside the row) instead of being mouse-only.
