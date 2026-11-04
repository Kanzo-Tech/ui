---
"@kanzo-tech/ui": minor
---

The `/table` parts take the words they draw through `translations`, as every other component does, so a translated table no longer has English left in it. `DataTablePagination` takes `selected(count, total)` and `rowsPerPage`, plus `Pagination`'s own `rootLabel`, `prevTriggerLabel`, `nextTriggerLabel`, `ellipsisLabel` and `itemLabel`, which it passes on; `DataTableViewOptions` takes `label` and `heading` (the menu's *Toggle columns*). **Breaking:** `selectColumn({ headerLabel, rowLabel })` is `selectColumn({ translations: { headerLabel, rowLabel } })`, `actionsColumn({ headerLabel })` is `actionsColumn({ translations: { headerLabel } })`, and `<DataTableViewOptions label="Vista" />` is `<DataTableViewOptions translations={{ label: "Vista" }} />`, which takes a string now. The types are `DataTablePaginationTranslations`, `DataTableViewOptionsTranslations`, `SelectColumnTranslations` and `ActionsColumnTranslations`.
