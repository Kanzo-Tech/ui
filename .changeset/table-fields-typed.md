---
"@kanzo-tech/kernel": minor
---

A `Table`'s fields carry their type: each is `{ name, nullable, type: { typeId } }`, as an Arrow
table's already are, so an engine's answer is handed to a reader that types columns by what the
engine answered (fossil's profile) without a conversion. DuckDB-WASM's tables need no change; a
`Table` built by hand — a test's fake answer — adds `nullable` and a `type` with Arrow's `typeId`
(`Schema.fbs`: 2 Int, 3 FloatingPoint, 5 Utf8, 6 Bool).
