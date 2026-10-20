---
"@kanzo-tech/mosaic": patch
---

A page that reads `s3://` under a vended credential no longer prints it to the browser console.
DuckDB-WASM's worker logged every header of the HTTP requests it sent, so each read through `httpfs`
printed its `Authorization` (with the access key id) and its `x-amz-security-token` (the whole STS
session token) as `HEAD <name> <value>` lines. `engine()` now starts DuckDB's worker inside a small
one of its own that drops those lines; your bundler emits it beside DuckDB's
(`duckdb.worker.<hash>.js`). If your server sends its static assets a Content-Security-Policy of
their own, its `script-src` must allow `'self'`, since that worker loads DuckDB's with
`importScripts`.
