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
```

- **Re-exports** of the coordinator, the clients, the five clause builders, the loaders and the
  connector — so a consumer boots a coordinator without a direct `@uwdata` import.
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
