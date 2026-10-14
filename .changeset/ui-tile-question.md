---
"@kanzo-tech/ui": minor
---

A dashboard tile carries its own question: `where`, conditions under the page's filter — `{ field, in }`, `{ field, between }` or `{ field, contains }`, the `Condition` type, a field being a path from the relation's root, crossed in when it leaves the relation — and `top`, a bar chart's first bars by its measure or a table's first rows. `tileQuery(table, tile, context)` is the one compiler of a tile — the relation narrowed by its question, its measure, and its rows — which every tile view reads through and `@kanzo-tech/ai/data`'s answers read too; `TileView` draws a tile of any kind, with `actions` in its header beside the pencil. `TILE_ROWS`, `TileContext`, `TileQuery`, `Condition`, `ConditionValue` and `TileViewProps` are exported from `@kanzo-tech/ui/analytics`. A tile naming a field or a path its relation cannot read draws what it lacks.

**Breaking:** `measureExpr` and `bucketExpr` are no longer exported from `@kanzo-tech/ui/analytics`: read a tile's measure and rows through `tileQuery`. A host that reads tiles itself reads their `where` and `top` too. A tile's fields are paths — `affiliation.university.name`, not `University.name` — so a dashboard saved with type-prefixed fields draws what it lacks: delete it, as the spec page says of anything an earlier release saved.
