---
"@kanzo-tech/mosaic": minor
---

**One crossfilter across relations, and no bridges.**

- New: `crossfilterOver(joins)` — the page's selection, Mosaic's crossfilter with a resolver
  (`JoinResolver`) that hands a client of the relation a clause was published on the clause as
  published, a client of another relation the joins reach `key IN (SELECT key FROM <relation> WHERE …)`,
  and a client of a relation with no way across `FALSE`. A clause says its relation with
  `onRelation(clause, relation)` (read back by `relationOf`); a client sets `relation`
  (`RelationClient`). `readOf(joins, relation)` is what a relation reads; `sameRelation` compares two.
- New: `preaggregateOwnRelation(coordinator)` — Mosaic's pre-aggregator is not asked for a client the
  active clause is crossed into, which would index it by another relation's columns.
- New: `holdFirstDraw(page)`, `firstDrawsPending`, `onFirstDraws` — what a page has yet to draw for
  the first time, counted on its selection.
- New: `JoinType.of`, the types a type that is their union holds.
- **Gone:** `bridgeSelection`, `bridged`, `clauseReadings`, `semiJoinOf` and the types `Bridged`,
  `BridgeOptions`, `ClauseMap`, `ClauseReading`. A clause on another relation crosses through the page's
  resolver; a clause's words are `clauseLabel(clause)`.
- **`relaySelection`'s options are `{ keep }`**, a predicate of the clauses to relay; `except`,
  `onArrive` and `onWithdraw` are gone.
