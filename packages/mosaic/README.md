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
- **`clauseSemiJoin` / `clauseColumns`** — the clause rule. A clause is column predicates on one
  relation, or a semi-join on identity: `clauseSemiJoin("dense_id", ids | query, { source, label })`
  is `dense_id IN (…)`, with the keys or with a statement that selects them, and it filters every
  relation whose rows carry the key, whatever the subquery reads. `clauseColumns(filter)` is the
  columns a clause names on the relation it filters — a subquery's are another relation's — which is
  how a client knows whether its relation answers it.
- **`bridgeSelection` / `semiJoinOf`** — a selection inside another, joined by a map.
  `bridgeSelection(inner, outer, map)` hands every clause of `outer` to `inner` as itself, and maps the
  clauses published into `inner` together into one clause of `outer`'s, whose source is the bridge;
  retracting either side retracts the other (`retract` for clauses held upstream of `inner`).
  `semiJoinOf(key, table)` is the map for a relation keyed by an identity, so a dashboard over a
  joined relation filters a graph.
- **`relaySelection(from, to)`** — `from`'s clauses into `to`, as the clause objects themselves,
  after both exist: what Mosaic's `include` does at construction. The bridge's outer half is one. It
  follows `from`'s state, so a reset travels, and its unrelay withdraws what it relayed.
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

`@kanzo-tech/ui/analytics` keeps the charts and re-exports these names, so a chart consumer imports
from one place.
