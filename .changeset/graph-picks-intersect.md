---
"@kanzo-tech/graph": patch
---

Picks made beside the canvas now narrow each other instead of replacing each other. Each place that
picks vertices (a search, a rule, an answer) publishes its own clause on the page's crossfilter
through the new `usePick(id)` hook, and the graph greys out what the clauses together leave out.

Breaking:

- `GraphSelect` and `GraphSelectProps` are removed. Call `usePick(id)` and render your own toggle:
  `pick(ids, label)` publishes the clause, `pick(null, label)` withdraws it, and `picked` is the
  clause's label while it holds, or `null`.
- `GraphApi.select` is removed, and `SelectionSource` no longer has `"external"`. A host that set the
  selection with `select(ids, "external", label)` calls `usePick(id).pick(ids, label)` instead.
- The search's ⌘Enter and its footer button, now **Add to the subset**, publish the search's own
  clause rather than the canvas's selection.
- The graph reads the vertex key from the column the corpus's `fossil_columns` gives the `address`
  role. A corpus that gives no such column is refused with `graph/nothing-to-draw`.
- A `GraphRoot` with no `filterBy` keeps a crossfilter of its own, so `usePick` works without a page
  selection.
