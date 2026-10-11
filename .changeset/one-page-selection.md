---
"@kanzo-tech/ui": minor
---

**The page has one selection, and `MosaicProvider` owns it.** Every chart, control, stat and
dashboard under the provider filters by it and publishes into it; nobody passes one in. Hand the
provider your join graph and a clause published on one relation reaches a part reading another —
crossed by key, or keeping none of it where there is no way across.

- **`MosaicProvider`'s `crossfilter` is gone; it takes `joins`.** `joins={await readJoinGraph(coordinator, from)}`
  for a fossil corpus, or nothing for a page of plain tables. Delete `crossfilter={…}`.
- **`useMosaic()` is the one hook**, returning `{ coordinator, selection, joins, onFailure }`.
  `useCrossfilter()` and `useSelected()` are gone: write `useMosaic().selection`.
  `crossfilter`, `selected`, `registerSelection`, `reset` and `retract` are gone from it:
  - *Clear filters* is `selection.reset()`; a chip's remove is `selection.reset([clause])`. Each
    calls the clause's source back, so a brush or a pick clears with it.
  - A selection of your own registered with `registerSelection` is an interactor's `as` or a mark's
    `filterBy` now, wired as vgplot wires it.
- **`GraphRoot`'s `filterBy` is `useMosaic().selection`**, under the provider.
- **A part of your own on a page with more than one relation says which it reads.** A `MosaicClient`
  sets `relation` (a type's name or a `Relation`) and publishes through `onRelation(clause, relation)`;
  `useChartQuery({ relation })`, or any part inside `<MosaicClients relation={…}>`, does it for you.
  `RelationExpr`, `RelationRef`, `RelationClient` and `onRelation` are new on `@kanzo-tech/ui/analytics`.
