---
"@kanzo-tech/ui": minor
---

**`ChartSearch` completes through a listbox instead of a native `<datalist>`.**

The clause is unchanged, and that is the point. `ChartSearch` is a **filter**, not a picker: it
publishes `clauseMatch` over whatever you typed, and the values it offers were only ever
completions. Turning it into a selector would have swapped one control for another without saying
so. Only the surface moved.

A `<datalist>` cannot be styled, renders differently in every browser, has no empty state, puts
nothing in the accessibility tree that a test or a screen reader can reach, and — worst of the
five — stops silently at its limit, so "nothing else matches" and "nothing else was asked for"
look identical.

The completions now come from the same query they always did (`SELECT DISTINCT column … LIMIT
autocompleteLimit`), narrow in the browser as you type, say when the list is capped, and are real
options you can click. Picking one publishes exactly the clause typing it would have.

Nothing changes for a caller: same props, same debounce, same clause. A `ChartSearch` with
`autocompleteLimit={0}` still renders the plain search input, because with no completions to offer
there is no listbox to open.
