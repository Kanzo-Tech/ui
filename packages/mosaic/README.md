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
import { Coordinator, Selection, MosaicClient, clausePoints, clauseSemiJoin } from "@kanzo-tech/mosaic";
import { numbers } from "@kanzo-tech/mosaic";
import { engine } from "@kanzo-tech/mosaic/engine";
```

- **`engine()`** — the page's one DuckDB-WASM database: `{ coordinator, query, registerFiles, registerFileBuffer, dropFiles }`,
  one per document however many callers ask. vgplot has one active coordinator, so a second boot is
  a second database the last-mounted chart wins. `registerFiles({ name: url })` registers a URL under a name:
  the same URL is a no-op, a different one drops the old lease and registers the new, which is what
  DuckDB-WASM's `File already registered` was refusing. `registerFileBuffer(name, bytes)` registers a copy
  of a buffer; `dropFiles(names)` forgets. The names are DuckDB-WASM's. `query(sql, { signal })` — the signal required — answers in columns — the Arrow table
  DuckDB-WASM produced, never rows as objects — through the coordinator, on its one connection and
  uncached; an abort rejects the caller's wait with `signal.reason`. It is fossil's `Engine`
  structurally, without depending on fossil.

  It boots with DuckDB's `httpfs` loaded, so `s3://` is readable once a secret says how:
  `query("CREATE OR REPLACE SECRET job (TYPE s3, …, SCOPE 's3://bucket/prefix/')", { signal })`, then name the
  objects by their URLs. A lent name has no scheme: `https://…` and `s3://…` in SQL are `httpfs`'s,
  and it answers before the registry is asked. `parquet` and `json` are loaded beside it, so Parquet
  and JSON (`read_json_auto`, `loadJSON`) are readable from boot.

  **Nothing is fetched from a CDN.** DuckDB-WASM's worker and module come from
  `@duckdb/duckdb-wasm`, a dependency at the exact release the extensions were built for; `parquet`,
  `httpfs` and `json` ship in this package (`extensions/`, fetched and hash-pinned at build by
  `scripts/extensions.mjs`). All five are reached through `new URL(…, import.meta.url)`, so your
  bundler emits them as assets — under Next, `/_next/static/media/duckdb-browser-eh.worker.<hash>.js`,
  `duckdb-eh.<hash>.wasm` and `<extension>.duckdb_extension.<hash>.wasm` for each, or their `mvp` siblings on a browser without WebAssembly
  exceptions — and there is nothing to copy. Autoloading is off: a function from an extension the
  engine did not load fails with DuckDB's error naming it, rather than fetching it from
  extensions.duckdb.org. Serve `.wasm` as `application/wasm` (Next does), and
  the page needs no origin but yours:
  `script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self' <your storage>`. No
  `blob:`: the worker is started from its own URL.

- **Re-exports** of the coordinator, the clients, the five clause builders, the loaders, `Query`
  with `asc` and `desc`, the aggregates (`count`, `sum`, `avg`, `min`, `max`, `median`, `quantile`,
  `stddev`, `mode`), `sql`, `verbatim` and the expression builders the charts, the graph and Ask
  write with — so a consumer never needs a direct `@uwdata` import. **This is the one door to
  Mosaic**: `@kanzo-tech/ui`'s charts, `@kanzo-tech/graph` and `@kanzo-tech/ai` import mosaic-core
  and mosaic-sql through it and nothing else, and `@kanzo-tech/ui/analytics` re-exports none of it.
  The DuckDB-WASM connector is not among them: `engine()` is the only boot.
- **`clauseSemiJoin` / `clauseColumns`** — the clause rule. A clause is column predicates on one
  relation, or a semi-join on identity: `clauseSemiJoin("dense_id", ids | query, { source, label })`
  is `dense_id IN (…)`, with the keys or with a statement that selects them, and it filters every
  relation whose rows carry the key, whatever the subquery reads. `clauseColumns(filter)` is the
  columns a clause names on the relation it filters — a subquery's are another relation's — which is
  how a client knows whether its relation answers it.
- **The join graph, the relations over it and the crossfilter across them** (`JoinGraph`,
  `crossfilterOver`, `JoinResolver`, `readJoinGraph`, the relation words) are
  `@kanzo-tech/relations`'s, which reaches Mosaic through this package.
- **`holdFirstDraw(page)` / `firstDrawsPending` / `onFirstDraws`** — what a page has yet to draw for
  the first time, counted on its selection: a chart holds it until its first answer is drawn, and the
  graph's first load waits for it.
- **`relaySelection(from, to, { keep })`** — `from`'s clauses into `to`, as the clause objects
  themselves, after both exist: what Mosaic's `include` does at construction. It follows `from`'s
  state, so a reset travels, and its unrelay withdraws what it relayed.
- **`numbers(answer, field)`** — one numeric column out of an answer, an Arrow table or an array
  of rows. Reading it is mosaic-core's `toDataColumns`; `numbers` adds the coercion, since Arrow
  hands back `BigInt` for some integer widths. A field the query did not select throws.
- **`TableExpr`** — what a `table` takes, here and in the charts: a string is one identifier in the
  default catalog, a mosaic-sql node is a relation named in SQL — `verbatim(relation.sql)` for a
  fossil corpus's catalog-qualified relation.

All of it is on Mosaic's public API: `packages/ui/src/mosaic-public-api.test.ts` fails on any `_`
member of a Mosaic object reached from any shipped package.

## Why it is not part of `@kanzo-tech/ui`

Reading a column out of an answer and publishing a clause are not user-interface concerns, and the
consumers that need them are not all charts. `@kanzo-tech/graph` depends on this package and not on
`@kanzo-tech/ui/analytics`, whose barrel imports `@uwdata/vgplot` statically: a host that draws a
graph and no chart installs no vgplot.

`@kanzo-tech/ui/analytics` keeps the charts and re-exports none of these names: a chart consumer
imports the charts from there and Mosaic from here, each name one way.
