---
"@kanzo-tech/mosaic": patch
"@kanzo-tech/ai": patch
---

**`engine()` ships DuckDB's `json` extension and fetches nothing from extensions.duckdb.org.** The
`@kanzo-tech/ai/data` statement gate parses through `json_serialize_sql`, which DuckDB-WASM does not
build in, so DuckDB fetched `json` from extensions.duckdb.org on the first question — a request a page
under `connect-src 'self' <storage>` refuses, and the gate with it. `json` now ships in
`@kanzo-tech/mosaic` beside `httpfs`, pinned by hash and emitted by your bundler as
`json.duckdb_extension.<hash>.wasm`; nothing to configure, and no new origin in your policy. DuckDB's
autoloading is off: a function from an extension the engine did not load fails with DuckDB's error
naming it. A coordinator you build over another DuckDB for the gate needs `json` loaded itself.
