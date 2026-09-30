---
"@kanzo-tech/ui": minor
---

**`useAsyncCollection` and `useDebouncedCommit`, for a control whose options or owner are somewhere
else.** `useAsyncCollection({ load })` gives a `Combobox` a collection fetched as the user types:
the query is debounced, a request the user has typed past is aborted, and `loading`, `empty` and
`error` describe the last one. `labelOf(value)` keeps a chosen item's label after the next batch
replaces the one that offered it, which is what a `multiple` combobox drawing its own chips needs.
`useDebouncedCommit(value, onCommit)` is the draft a text control keeps while its owner is
expensive to write to: `change` on each keystroke, `flush` on blur, `commit` for a pick. Replace a
hand-written debounce-and-abort effect around `useListCollection` with the first, and a
`setTimeout` in an `onChange` with the second.
