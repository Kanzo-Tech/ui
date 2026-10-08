---
"@kanzo-tech/mosaic": minor
---

`engine()`'s file registry takes DuckDB-WASM's names, which are also the names
`@fossil-lang/types` 0.3.0-alpha.27's `Engine` asks for: `lend(files)` is `registerFiles(files)`,
`hold(name, bytes)` is `registerFileBuffer(name, bytes)` and `drop(names)` is `dropFiles(names)`.
Rename the calls; what each does is unchanged. The engine is handed to fossil's `attach` as before,
and an engine from an earlier `@kanzo-tech/mosaic` no longer satisfies fossil 0.3.0-alpha.27.
