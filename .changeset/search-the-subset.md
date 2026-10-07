---
"@kanzo-tech/graph": patch
"@kanzo-tech/mosaic": patch
---

The search palette now searches the subset: it lists the matches every other clause on the page
keeps, and its footer says how many more lie outside — "12 matches · 40 more outside the subset", or
"None in the subset · 40 outside it". Its button reads **Add N to the subset** and adds the N inside.

`usePick(id)` gains `predicate()`, every clause on the crossfilter but that place's own, so a panel
can read the subset without being narrowed by its own pick. `GraphStore.source(id)` now returns a
`PickSource`, a `MosaicClient` that is never connected.

`@kanzo-tech/mosaic` re-exports mosaic-sql's `and`, `not` and `sum`.
