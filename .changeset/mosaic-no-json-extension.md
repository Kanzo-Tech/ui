---
"@kanzo-tech/mosaic": minor
---

**`engine()` no longer loads DuckDB's `json` extension, and the package no longer ships it.** It was
there for `@kanzo-tech/ai`'s SQL gate, which v0.34.0 removed. A page boots one asset lighter — about
820 kB (190 kB gzipped) less on the usual `eh` bundle — and the installed package is about 1.5 MB
smaller.

**What to do:** nothing, unless your own SQL through `engine.query` calls a `json` function
(`read_json`, `json_extract`, `->>`, `to_json`, …). With autoloading off that now fails with DuckDB's
error naming `json`; tell us and it goes back in.
