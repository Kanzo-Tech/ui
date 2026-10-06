---
"@kanzo-tech/mosaic": minor
---

**`relaySelection(from, to, { except, onArrive, onWithdraw })`** relays one selection's clauses into
another, as the clause objects themselves, so a chart is still exempt from its own clause. It returns
a function that stops the relay and withdraws everything it relayed. `MosaicProvider` and
`bridgeSelection` now use it, and nothing in the family reaches a private member of Mosaic.

**`clauseParts(clause)` and `clauseLabel(clause)`** say what a clause filters on, in words: the field,
the operator and the value, and the chip label they make.

**Breaking:** `column` is removed. Read an Arrow answer with `numbers(data, field)`, which now reads
through mosaic-core's `toDataColumns` and throws `the answer has no column "<field>"` for a field the
query did not select. For any other column type, call `toDataColumns` from `@uwdata/mosaic-core`.

The DuckDB-WASM engine now uses `DuckDBWASMConnector` instead of the deprecated `wasmConnector`.
Nothing changes for you.
