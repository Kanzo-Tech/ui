---
"@kanzo-tech/mosaic": minor
---

`engine` and `Engine` come from `@kanzo-tech/mosaic/engine`; `Table` and `Vector` from `@kanzo-tech/kernel`.
The root of `@kanzo-tech/mosaic` no longer has `engine` or `Engine`: replace
`import { engine, type Engine } from "@kanzo-tech/mosaic"` with
`import { engine, type Engine } from "@kanzo-tech/mosaic/engine"`. A page that imports only the root
no longer reaches DuckDB-WASM.
