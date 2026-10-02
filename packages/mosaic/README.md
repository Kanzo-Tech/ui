# @kanzo-tech/mosaic

The Mosaic conversation, without React.

```bash
npm install @kanzo-tech/mosaic @uwdata/mosaic-core @uwdata/mosaic-sql
```

`mosaic-core` and `mosaic-sql` are **required** peers, not optional ones. There is nothing here
without them — that is what this package is. Installing them once is also the point: two copies of
Mosaic are two coordinators, and two coordinators are two crossfilters that never hear each other.

## What it holds

```ts
import { Coordinator, Selection, MosaicClient, clausePoints } from "@kanzo-tech/mosaic";
import { column, numbers } from "@kanzo-tech/mosaic";
import { engine } from "@kanzo-tech/mosaic";
```

- **`engine()`** — the page's one DuckDB-WASM database: `{ coordinator, query, lend, hold, drop }`,
  one per document however many callers ask. vgplot has one active coordinator, so a second boot is
  a second database the last-mounted chart wins. `lend({ name: url })` registers a URL under a name:
  the same URL is a no-op, a different one drops the old lease and registers the new, which is what
  DuckDB-WASM's `File already registered` was refusing. `hold(name, bytes)` registers a copy of a
  buffer; `drop(names)` forgets. `query(sql, { signal })` — the signal required — answers in columns — the Arrow table
  DuckDB-WASM produced, never rows as objects — through the coordinator, on its one connection and
  uncached; an abort rejects the caller's wait with `signal.reason`. It is fossil's `Engine`
  structurally, without depending on fossil.

  It boots with DuckDB's `httpfs` loaded, so `s3://` is readable once a secret says how:
  `query("CREATE OR REPLACE SECRET job (TYPE s3, …, SCOPE 's3://bucket/prefix/')", { signal })`, then name the
  objects by their URLs. A lent name has no scheme: `https://…` and `s3://…` in SQL are `httpfs`'s,
  and it answers before the registry is asked.

  **Nothing is fetched from a CDN.** DuckDB-WASM's worker and module come from
  `@duckdb/duckdb-wasm`, a dependency at the exact release `httpfs` was built for; `httpfs` ships in
  this package (`extensions/`, fetched and hash-pinned at build by `scripts/extensions.mjs`). All
  three are reached through `new URL(…, import.meta.url)`, so your bundler emits them as assets —
  under Next, `/_next/static/media/duckdb-browser-eh.worker.<hash>.js`, `duckdb-eh.<hash>.wasm` and
  `httpfs.duckdb_extension.<hash>.wasm`, or their `mvp` siblings on a browser without WebAssembly
  exceptions — and there is nothing to copy. Serve `.wasm` as `application/wasm` (Next does), and
  the page needs no origin but yours:
  `script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self' <your storage>`. No
  `blob:`: the worker is started from its own URL.

- **Re-exports** of the coordinator, the clients, the five clause builders and the loaders — so a
  consumer never needs a direct `@uwdata` import. The DuckDB-WASM connector is not among them:
  `engine()` is the only boot.
- **`column` / `numbers`** — the half of the client protocol the protocol does not
  give you. The coordinator answers with an Arrow table, and Arrow offers a typed column only when
  the type allows one: an integer id gives an array, a dictionary-encoded label gives nothing
  usable. Every call site was writing `as { getChild(name: string): … }`, which asserts Arrow's
  shape rather than checking it, and is wrong on the first query that selects a string.
- **`TableExpr`** — what a `table` takes, here and in the charts: a string is one identifier in the
  default catalog, a mosaic-sql node is a relation named in SQL — `verbatim(relation.sql)` for a
  fossil corpus's catalog-qualified relation.

## Why it is not part of `@kanzo-tech/ui`

Reading a column out of an answer and publishing a clause are not user-interface concerns, and the
consumers that need them are not all charts. `@kanzo-tech/graph` depends on this package and not on
`@kanzo-tech/ui/analytics`, whose barrel imports `@uwdata/vgplot` statically: a host that draws a
graph and no chart installs no vgplot.

`@kanzo-tech/ui/analytics` keeps the charts and re-exports these names, so a chart consumer imports
from one place.
