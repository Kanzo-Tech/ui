---
"@kanzo-tech/ui": minor
---

A `count` counts what is measured: across a hop it is `count(DISTINCT …)` of the relation's root key, so *prizes by university* counts a prize once per university however many joined rows lead there — Malloy's `count()`. A count may name a path, `{ op: "count", path: "affiliation" }`, and counts the rows that step reaches — Malloy's `path.count()`. On a type alone it is the row count, as before.

**Breaking:** a `count` over a relation with hops is lower wherever a hop fanned out; a measure that names a `path` must be a `count`.
