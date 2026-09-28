---
"@kanzo-tech/mosaic": minor
---

**`engine()` reads `s3://`.** The database boots with DuckDB's `httpfs` loaded, so a reader holding a
credential scoped to a prefix makes it readable with one statement through the door that already
exists:

```ts
const e = await engine();
await e.query(`CREATE OR REPLACE SECRET job (TYPE s3, KEY_ID '…', SECRET '…', SESSION_TOKEN '…',
  REGION '…', ENDPOINT '…', SCOPE 's3://bucket/jobs/42/')`);
await e.query(`SELECT count(*) FROM read_parquet('s3://bucket/jobs/42/vertex/*/tiles.parquet')`);
```

Reads are by range, each request signed with the secret: a count, a point lookup and a max over a
160 MiB Parquet file moved 1 MiB. The `Engine` API is unchanged.

**The extension is yours to serve.** It ships in this package and is referenced with
`new URL(…, import.meta.url)`, so your bundler emits it as an asset (webpack names it
`httpfs.duckdb_extension.<hash>.wasm`) and the page loads it from your own origin. Nothing is fetched
from extensions.duckdb.org; a CSP needs no entry for it. The package grows by 815 kB on disk, of which
a page downloads one 370–445 kB build.

**Lend under a name without a scheme.** With `httpfs` loaded, `https://…` and `s3://…` in SQL are
read by it before the registry is asked, so a lease registered under such a name is never consulted.
