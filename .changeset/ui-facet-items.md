---
"@kanzo-tech/ui": minor
---

One facet item: `DataTableFacetFilter` and `ChartFilter` take `items` of `FacetFilterItem` — `{ value, label?, icon?, count? }`, from `@kanzo-tech/ui` — as `FacetFilter` already did. `DataTableFacetFilter` keeps an item's own `count` and gives one without it the column's.

**Breaking:** `DataTableFacetFilter` and `ChartFilter` take `items`, not `options`; `DataTableFacetOption` and `ChartFilterOption` are gone — type your items as `FacetFilterItem`. A `ChartFilter` item is an object with a string `value` (`{ value: "3" }`, not a bare `3`): a ticked item publishes the column's value when the control has read it, and otherwise its text, which DuckDB compares with a number or boolean column as it compares any string literal.
