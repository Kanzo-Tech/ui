# @kanzo-tech/relations

The library's one read-model of a graph's catalog: `JoinGraph`, a relation over it, the crossfilter
that crosses a clause between relations, the words a thing is called by, and the reader that makes a
`JoinGraph` from an attached GraphAr graph. No canvas, no engine, no React. The argument is
`/docs/design/relations`.

```bash
npm install @kanzo-tech/relations @kanzo-tech/mosaic @uwdata/mosaic-core @uwdata/mosaic-sql
```

`@kanzo-tech/mosaic` is a required peer: the crossfilter is a Mosaic `Selection`, and one copy of
Mosaic is what makes one crossfilter.

```ts
import { readJoinGraph, crossfilterOver, relationQuery, labelOf, withMapping } from "@kanzo-tech/relations";
import type { JoinGraph, Relation, CatalogReader } from "@kanzo-tech/relations";
```

- **`readJoinGraph(engine, from, { signal })`** — the reader of a GraphAr graph that
  `@kanzo-tech/graphar-duckdb`'s `attachGraph` attached as `from`, through any `Queryable`
  (`@kanzo-tech/kernel`). It is a `CatalogReader`, the one shape a catalog is read in.
- **`JoinGraph`** and its parts (`JoinType`, `JoinEdge`, `JoinColumn`, `JoinColumnStats`,
  `JoinAnnotation`); **`Relation`** and **`Hop`**; `relationQuery`, `relationColumns`, `relationHops`,
  `relationKey`.
- **`crossfilterOver(joins)`**, **`JoinResolver`**, `onRelation`, `relationOf`, `sameRelation`,
  `readOf`, `preaggregateOwnRelation`, `JoinMiss`.
- **`labelOf`**, `namingColumn`, `splitWords`, `typeWords`, `edgeWords`; **`withMapping`** and
  `MappingModel`.
