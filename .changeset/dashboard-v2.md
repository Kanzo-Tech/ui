---
"@kanzo-tech/ui": minor
"@kanzo-tech/mosaic": minor
"@kanzo-tech/graph": minor
---

**Dashboard spec v2: tiles, one editor, a filter bar of chips, and relations.** This breaks the stored spec, and `migrateDashboards` reads the old one.

- `DashboardSpec` is now `{ version: 2, filters, tiles }`. `Tile` is `StatTile | ChartTile | TableTile`, told apart by `kind`, and each has `span: 1 | 2 | 3`. `stats`, `cards` and `detail` are gone. `DashboardCardSpec` is now `ChartTile`, `DashboardStatSpec` is `StatTile` with `title` in place of `label`, and the rows table is a `TableTile`. `Recommendation.spec` is a `ChartTile`.
- Read whatever you stored through `migrateDashboards(saved)`. It turns `{ version: 1, byType: { T: spec } }` into `Dashboards`, `{ version: 2, byRelation: { T: spec } }`. Every field is renamed to `T.field`, because that is what the relation of `T` names its columns. Store what `onChange` hands you under `byRelation[relationKey(graph, relation)]`.
- Tiles are edited in one side sheet, `TileEditor`, for both Add and Edit. `ChartCard` and `DashboardStat` take `onEdit` in place of `onChange`, `onRemove` and `onMove`. `DetailTable` loses `onChange` and its Columns menu: a table tile's columns are chosen in the editor.
- `DashboardFilters` is a bar of chips (*column: value ▾*), with **+ Filter** and **Clear**. The readout no longer lists every clause; use `FilterChips` for that.
- Relations: `relationQuery(graph, relation)` turns a root type and its hops into a `Query`, which is a `TableExpr` like any table. Every column is prefixed by its step (`Person.country`), and the root's key keeps its own name. `relationKey`, `relationIdentities` and `relationHops` come with it, plus the `Relation`, `Hop`, `JoinGraph`, `JoinType`, `JoinEdge` and `RelationHop` types. They come from `@kanzo-tech/mosaic` and are re-exported from `/analytics`. `RelationPicker` replaces a host's type tabs.
- `@kanzo-tech/graph`'s `readJoinGraph(coordinator, from)` builds the `JoinGraph` of a fossil corpus.
- `useFieldStats` and `queryFieldStats` run `SUMMARIZE` over `SELECT * FROM` the relation, so a joined relation is summarized like a table.
