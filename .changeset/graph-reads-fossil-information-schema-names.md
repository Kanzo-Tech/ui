---
"@kanzo-tech/graph": minor
---

The graph reads a corpus attached by `@fossil-lang/corpus`'s `attach`, under the column names that
release gives its catalog: `fossil_tables.record_count` (was `rows`), and
`fossil_columns.ordinal_position` and `data_type` (were `ordinal` and `type`). Attach the corpus
with `attach(name, { engine, url })` or `attach(job, { engine, host })` where you called `open`,
and give it back with the attachment's `detach()`, or `await using`, where you called the function
`open` answered. A corpus attached by an earlier `@fossil-lang/corpus` no longer reads, so upgrade
both together.
