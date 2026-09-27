---
"@kanzo-tech/mosaic": patch
"@kanzo-tech/ui": patch
---

**A lent file is read by range again.** DuckDB-WASM 1.30 and later download a registered URL whole
unless full HTTP reads are refused (duckdb/duckdb-wasm#2228), so every `lend` was a full download of
the file. `engine()` now opens its database with `forceFullHTTPReads: false`; DuckDB then reaches
its `HEAD` probe and reads only the byte ranges a query needs.

That probe needs a URL that answers `HEAD`. A presigned GET does not — S3 binds the signature to the
method — so a host lends a locator of its own that redirects to a URL signed for the method asked.
