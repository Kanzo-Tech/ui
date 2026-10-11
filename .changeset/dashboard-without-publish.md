---
"@kanzo-tech/ui": minor
---

**A dashboard publishes on its relation, and the page crosses it.** `Dashboard`'s `publish` is gone,
and with it the dashboard's own selection: its tiles publish into the page's one selection, on the
dashboard's relation, and a graph or another relation beside it reads their clauses as a semi-join on
the root's key — what `publish={semiJoinOf(…)}` did, with nothing to wire. Delete `publish` and the
`semiJoinOf` that built it; `semiJoinOf` and `ClauseMap` are gone from `@kanzo-tech/ui/analytics`.

`FilterBar` shows each tile's clause as its own chip, named by its field — *Person.country Spain* —
rather than as a part named after the dashboard (*Person Person.country Spain*).
