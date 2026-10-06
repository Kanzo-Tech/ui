---
"@kanzo-tech/mosaic": patch
"@kanzo-tech/ai": patch
---

**`engine()` ships DuckDB's `parquet` and `json` extensions and fetches nothing from
extensions.duckdb.org.** DuckDB-WASM builds in neither, so DuckDB fetched `parquet` from
extensions.duckdb.org on the first Parquet read and `json` on the `@kanzo-tech/ai/data` statement
gate's first question (it parses through `json_serialize_sql`) — requests a page under
`connect-src 'self' <storage>` refuses, and the read or the gate with them. Both now ship in
`@kanzo-tech/mosaic` beside `httpfs`, pinned by hash and emitted by your bundler as
`parquet.duckdb_extension.<hash>.wasm` and `json.duckdb_extension.<hash>.wasm`; nothing to
configure, and no new origin in your policy. DuckDB's autoloading is off: a function from an
extension the engine did not load fails with DuckDB's error naming it. A coordinator you build over
another DuckDB for the gate needs `json` loaded itself.
