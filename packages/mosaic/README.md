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
import { column, fillColumn, numbers, IdSetClient } from "@kanzo-tech/mosaic";
import { engine } from "@kanzo-tech/mosaic";
```

- **`engine()`** — the page's one DuckDB-WASM database: `{ coordinator, query, lend, hold, drop }`,
  one per document however many callers ask. vgplot has one active coordinator, so a second boot is
  a second database the last-mounted chart wins. `lend({ name: url })` registers a URL under a name:
  the same URL is a no-op, a different one drops the old lease and registers the new, which is what
  DuckDB-WASM's `File already registered` was refusing. `hold(name, bytes)` registers a copy of a
  buffer; `drop(names)` forgets. It is fossil's `Engine` structurally, without depending on fossil.

- **Re-exports** of the coordinator, the clients, the five clause builders and the loaders — so a
  consumer never needs a direct `@uwdata` import. The DuckDB-WASM connector is not among them:
  `engine()` is the only boot.
- **`column` / `fillColumn` / `numbers`** — the half of the client protocol the protocol does not
  give you. The coordinator answers with an Arrow table, and Arrow offers a typed column only when
  the type allows one: an integer id gives an array, a dictionary-encoded label gives nothing
  usable. Every call site was writing `as { getChild(name: string): … }`, which asserts Arrow's
  shape rather than checking it, and is wrong on the first query that selects a string.
- **`IdSetClient`** — the crossfilter adapter for a view whose positions are not in the database.
  A GPU canvas or a map cannot publish `weight BETWEEN …`; there is no column to write the
  predicate over. It can only enumerate what was hit.

## Why it is not part of `@kanzo-tech/ui`

It was, and the cost landed somewhere else. `@kanzo-tech/graph/duckdb` reached its coordinator
through `@kanzo-tech/ui/analytics`, whose barrel re-exports the React charts first — and calls
`@uwdata/vgplot` doing it. The import is static, so a host that installed the two peers the docs
asked for still could not open that subpath: vgplot came along, unasked and unused.

Reading a column out of an answer and publishing a clause are not user-interface concerns. They
lived in a component library only because that is where the first chart needed them.

The charts did not move. [`@kanzo-tech/ui/analytics`](https://kanzo-tech.github.io/ui) exports
every name it exported before, these among them.
