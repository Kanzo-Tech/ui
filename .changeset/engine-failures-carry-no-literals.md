---
"@kanzo-tech/mosaic": minor
---

A statement DuckDB refuses is now thrown as an `EngineError` with `code` `"engine/failed"`, from
`Engine.query` and from the coordinator the charts and the graph read through, and what reaches your
`onFailure` carries no value a user typed: `message` is DuckDB's message and `data.statement` is the
statement, each with every string and number literal replaced by `?` (`id IN (1, 2, 3)` reads
`id IN (?)`). A failing `CREATE SECRET` is not echoed at all, so a credential never reaches your
telemetry. The original text is on no field and not on `cause`, and the coordinator no longer logs the
failure, with its statement, to the console. Code that read the SQL out of a failure's message must
stop; there is no switch to turn the literals back on.
