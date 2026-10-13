---
"@kanzo-tech/mosaic": patch
---

The engine reads JSON. `engine()` now loads DuckDB's `json` extension at boot beside `parquet` and `httpfs`, shipped and hash-pinned in the package like them, so `read_json_auto` — a profile of a `.json` file, a query naming one, and `loadJSON` from `@kanzo-tech/mosaic` or `@kanzo-tech/ui/analytics` — answers instead of failing with "Table Function with name read_json_auto is not in the catalog, but it exists in the json extension". Nothing to change on your side: your bundler emits `json.duckdb_extension.<hash>.wasm` as one more asset from your own origin, and the page's policy is unchanged.
