---
"@kanzo-tech/mosaic": minor
"@kanzo-tech/graph": minor
"@kanzo-tech/ui": minor
---

One selection, many clients: a clause on the page's selection is column predicates on one relation, or a semi-join on identity.

- `@kanzo-tech/mosaic`: `clauseSemiJoin(key, ids | query, { source, clients?, label? })` publishes `key IN (…)` — with the keys, or with a mosaic-sql `Query` that selects them — so a set of rows found in one relation filters every relation that carries the key. `clauseColumns(filter)` reads the columns a clause names on the relation it filters, leaving a subquery's out. `collectColumns` is no longer re-exported: it walked into subqueries, which is the reading `clauseColumns` replaces.
- `@kanzo-tech/graph`: the reader's pick (lasso, marquee, click, `GraphSelect`, a search's or a neighbourhood's selection) is published as `clauseSemiJoin("dense_id", ids, { label })` with the selection's label. The graph answers a semi-join on `dense_id` on every vertex table, whatever its subquery reads, and applies each column clause to the tables that have its columns; `graph/unfilterable` is raised only for a column clause no vertex table can answer. Retracting the graph's clause where it was published — a `FilterChips` chip, the page's reset — clears the selection on the canvas and calls `onSelect(null)`.
- `@kanzo-tech/ui/analytics`: re-exports `clauseSemiJoin`, `clauseColumns` and their types. `FilterChips` names a semi-join by its publisher's label (*Lasso · 13 selected*), so over the crossfilter it is the page's scope readout.
