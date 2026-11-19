---
"@kanzo-tech/ui": patch
---

`useClauses(selection)` answers the same array until the selection's clauses change, so it can be a dependency of a memo or an effect without firing on every render, and it has the clauses already on the first render rather than an empty list for one frame. The array is the selection's own: read it, do not change it.
