---
"@kanzo-tech/graph": patch
---

**`GraphCounts` and `GraphLegend` count what is in full colour, the canvas's own pick included.** A
lasso, a marquee or a click on the canvas greys what it leaves out, and the toolbar read *31 of
3,218*, but the counts beside it still read the page's filter alone — *40 match · 3.2K of 3.2K
placed* — and the legend *Airport 40 of 3,218*: the graph's client is exempt from the clause it
publishes, as Mosaic exempts every client, so the filter it is handed never holds its own pick. Both
now count the page's filter narrowed to that pick, what `GraphStore.visible()` lists and the canvas
colours: *31 match · 3.2K of 3.2K placed*, *Airport 31 of 3,218*. A pick on an unfiltered page reads
as a filter, *2 of 20 nodes match*.

`GraphState.matching` and `drawn` follow: they are what is in full colour, `null` for `matching`
only when nothing is filtered or picked. A host that read `matching` as the page's filter without
the canvas's pick reads it from `mask` instead.
