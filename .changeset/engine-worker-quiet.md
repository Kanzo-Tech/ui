---
"@kanzo-tech/mosaic": patch
---

A page that reads `s3://` under a vended credential no longer prints it to the browser console.
DuckDB-WASM's worker logged every header of the HTTP requests it sent, so each read through `httpfs`
printed its `Authorization` (with the access key id) and its `x-amz-security-token` (the whole STS
session token) as `HEAD <name> <value>` lines. `engine()` now starts this package's copy of that
worker, the same release with that one statement removed; your bundler emits it from
`@kanzo-tech/mosaic/workers/` instead of `@duckdb/duckdb-wasm/dist/`, and there is nothing to change
in your code or your CSP.
