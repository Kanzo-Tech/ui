---
"@kanzo-tech/mosaic": minor
"@kanzo-tech/graph": minor
---

**A gesture acts on the canvas's own clause and nothing else's, and Alt with no clause leaves out what
it caught** (`/docs/design/crossfilter`, decided 11 October 2026).

- **Alt + drag with no canvas clause publishes `NOT (key IN caught)`.** It used to copy what was in
  full colour — another source's result — less what it caught, and that copy went stale when the
  other source changed. Now *Spain less Madrid* is the search's *Spain* and the canvas's *not
  Madrid*, and stays right whatever the search becomes. ⌘ with no clause keeps what it caught.
- **The canvas's clause keeps a set or leaves one out**: `Selection` gains `excludes`, and
  `GraphStore.select(vertices, source, label, excludes?)` takes it. ⌘ adds to a kept set and takes
  from a left-out one; Alt the reverse; a clause that leaves nothing out is cleared. A host that
  reads `onSelect`'s `Selection` should read `excludes` before treating `vertices` as kept.
- **New in `@kanzo-tech/mosaic`: `clauseAntiJoin(key, members, options)`**, the anti-join on
  identity beside `clauseSemiJoin`, with `AntiJoinMetadata` (`type: "antijoin"`). It names the key
  alone, so every relation that carries the key answers it; its chip reads *Lasso · 3 left out*.
- **`usePick(id).pick([])` keeps nothing**; only `pick(null)` withdraws. It used to withdraw, while
  `clauseSemiJoin(key, [])` kept nothing — one empty set, two opposite meanings.

The graph's size budget is raised as a decision, from 24.1 kB to 24.3 kB: 24.04 kB measured before
this change and 24.25 kB after — the anti-join clause, its branch in `keptOf` and the gesture's
algebra; sharing one constructor between the two identity clauses did not move it.
