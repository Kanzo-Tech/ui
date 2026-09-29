---
"@kanzo-tech/mosaic": minor
---

**Breaking:** `engine().query(sql)` answers in columns, not rows. It returns the Arrow table
DuckDB-WASM produced — `numRows`, `schema.fields`, and `getChild(name)` with `get(i)` and
`toArray()` — where it returned `Record<string, unknown>[]`. Read a column with
`answer.getChild("n")?.toArray()`, or `column`/`numbers` from this package, instead of
`rows.map((row) => row.n)`.

`query` takes `{ signal }`. An abort interrupts the statement that is running, not only the ones
queued behind it, and the promise rejects with `signal.reason`. Statements from `query` run one at
a time on a connection of their own, beside the coordinator's.

fossil's `open(url, { engine })` takes the engine as it is; pass it there rather than
`{ query: e.query }`.
