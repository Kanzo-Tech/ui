---
"@kanzo-tech/ai": minor
---

A kept Ask chat now stores the questions and none of the data. `useAskChat` defaults `keep` to the new
`askKeep` (exported from `@kanzo-tech/ai/data`), which cuts each answer's `rows` and leaves its spec
and tile, and a loaded chat's answers are read again on the page's engine, so the cards fill with
the rows as they are now. If you wrote your own `keep` to empty Ask's rows, delete it; if you
store rows on purpose, pass `keep: (part) => part`. A chat already stored with `rows` keeps drawing them until it is next saved.
