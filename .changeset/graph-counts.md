---
"@kanzo-tech/graph": minor
---

**`GraphLegend` is the category rows only; what is drawn of the whole is the new `GraphCounts`.**
The legend's last line, "N of M drawn", is gone, and a legend with no category to key (colour a
constant, nothing on `symbol`) now renders nothing instead of an empty box. `GraphCounts` says it
in one sentence — "1.2K of 5K nodes drawn · 8K edges" — compact in the nearest `LocaleProvider`'s
locale, with "—" for a figure not yet known and an optional `spinner` while the graph loads.
`Drawn` gains `edges`, the links whose two ends are drawn. If you read the count off the legend, put
`<GraphCounts />` where you want it.
