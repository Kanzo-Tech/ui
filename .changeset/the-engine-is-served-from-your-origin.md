---
"@kanzo-tech/mosaic": minor
---

**`engine()` fetches nothing from a CDN.** DuckDB-WASM's worker and module were loaded from
jsDelivr — the worker through a `blob:` that `importScripts` it — so a page's policy had to allow
`https://cdn.jsdelivr.net` in `script-src` and `connect-src`, and `blob:` in `worker-src`. They now
come from `@kanzo-tech/mosaic`'s own `@duckdb/duckdb-wasm`, a dependency pinned exactly to the release
its `httpfs` was built for, and are named with `new URL(…, import.meta.url)` like the extension, so
your bundler emits all three as assets and the page loads them from your origin:

```
script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self' <your storage>
```

There is nothing to copy into `public/`; serve `.wasm` as `application/wasm` (Next does). Next's
webpack and Turbopack both emit them as `/_next/static/media/duckdb-browser-eh.worker.<hash>.js`,
`duckdb-eh.<hash>.wasm` and `httpfs.duckdb_extension.<hash>.wasm` (the `mvp` builds on a browser
without WebAssembly exceptions).

**Drop `@duckdb/duckdb-wasm` from your own dependencies** unless you import it yourself: it arrives
with this package, and `@kanzo-tech/ui/analytics` never needed it.
