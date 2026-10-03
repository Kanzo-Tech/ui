---
"@kanzo-tech/graph": minor
---

**`GraphStatus` says where the graph is in one word, and `GraphCounts` stops saying "drawn".**

- New part `GraphStatus`: a badge with a status dot that reads Loading, Laying out 42%, Ready or
  Failed. It folds the data's `status` and the layout's `motion` and `progress` together, so a
  running layout over a loaded graph no longer shows as "idle". If your footer drew its own badge
  from `useGraphState((s) => s.status)`, delete it and render `<GraphStatus />`. The word is a polite
  live region; the badge is `aria-busy` while loading or laying out.
- `GraphCounts` now reads "5K nodes · 8K edges" with no filter and "1.2K of 5K nodes match · 3K edges"
  under the page's filter, instead of "1.2K of 5K nodes drawn · 8K edges". A test or a snapshot that
  matched the old sentence needs the new one. The `spinner` prop is gone: remove it, and put
  `<GraphStatus />` beside the counts where you relied on the spinner.
- `GraphState` has a new field, `matching`: how many vertices of the corpus the page's filter keeps,
  or `null` when nothing is filtered.
- The type `GraphStatus` is renamed `DataStatus`, because the part takes the name. Edit
  `import type { GraphStatus }` to `import type { DataStatus }`; the values are unchanged.
