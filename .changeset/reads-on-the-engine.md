---
"@kanzo-tech/ui": patch
"@kanzo-tech/mosaic": minor
---

`useFieldStats` and `useQueryRows` read on the engine's own door, `engine.query(sql, { signal })`,
not through the coordinator's queue. `useFieldStats` hands it the query's signal, so a `SUMMARIZE`
stops in the engine when every part that asked has unmounted. `useQueryRows` answers the same rows,
built from the engine's columns. New in `@kanzo-tech/mosaic`: `rowsOf(table)`, an engine answer as
objects keyed by column.
