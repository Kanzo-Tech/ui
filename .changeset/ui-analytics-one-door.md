---
"@kanzo-tech/ui": minor
"@kanzo-tech/mosaic": minor
---

Mosaic has one door: `@kanzo-tech/mosaic`. `@kanzo-tech/ui/analytics` now exports only the charts and their parts, and every Mosaic name it used to pass through comes from `@kanzo-tech/mosaic`, which gains the aggregates (`avg`, `min`, `max`, `median`, `quantile`, `stddev`, `mode` beside `count` and `sum`), `verbatim`, and the builders the charts write with.

**Breaking:** import `engine`, `Engine`, `Coordinator`, `Selection`, `JoinGraph`, `Relation`, `RelationExpr`, `relationKey` and the other `relation*` helpers, `numbers`, `queryFailure`, `Query`, `TableExpr`, `ExprValue`, `FilterExpr`, `MosaicClient`, `makeClient`, every `clause*`, `onRelation`, the `load*` loaders, the aggregates, `sql`, `asc` and `desc` from `@kanzo-tech/mosaic`; `@kanzo-tech/ui/analytics` no longer exports them. Split the import in two:

```ts
import { count, engine, Query, type JoinGraph } from "@kanzo-tech/mosaic";
import { ChartBarY, ChartRoot, Dashboard, MosaicProvider } from "@kanzo-tech/ui/analytics";
```

`bin` and the six axis marks (`axisX`, `axisY`, `axisFx`, `axisFy`, `gridFx`, `gridFy`) stay on `/analytics`. `@kanzo-tech/ui` no longer lists `@uwdata/mosaic-core` and `@uwdata/mosaic-sql` as its own peers: they are `@kanzo-tech/mosaic`'s, so keep them installed beside it.
