---
"@kanzo-tech/ui": minor
---

**`@kanzo-tech/ui/table` has `actionsColumn()`, a trailing row-menu column.** Pass `label(row)` for
the trigger's accessible name and `menu(row)` returning the row's `MenuItem`s; return `null` and that
row gets no trigger. Neither the trigger nor the menu fires `onRowClick`. Replace a hand-written
`id: "actions"` column — its `Menu`, icon `Button` and `stopPropagation` — with
`actionsColumn({ label, menu })`, keeping your items as they are.

`DataTableContent` now gives a column header a width when its column declares its own `size`.
Columns without one size to their content as before.
