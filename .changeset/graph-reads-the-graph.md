---
"@kanzo-tech/graph": minor
---

`GraphRoot` and `useGraph` take `graph`, the `Graph` `@kanzo-tech/graphar-duckdb`'s `attachGraph`
answers, in place of `from` (a catalog name) and `mapping`. `graph={null}` is no graph yet.
`GraphState.structure` is that `Graph`. A temporal column is a `date` or a `timestamp` property; a
year stored as an integer is no longer offered to the timeline.

`verticesOf(graph)` is new: every vertex as one relation, for a chart beside the canvas —
`<ChartTimeline relation={verticesOf(graph)} … />` where you wrote `relation="vertices"`.
