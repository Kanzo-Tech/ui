---
"@kanzo-tech/graph": minor
"@kanzo-tech/testing": patch
---

**On a map, the counts and the legend say how much of the corpus the map places.**

- **`GraphCounts` says "placed" under bound positions**, where a vertex with no value in `x` or `y`
  is hidden rather than greyed, and gives both figures as drawn of total: *33.4K of 206.6K nodes
  placed · 0 of 316.8K edges*, and under the page's filter *1.2K match · 33.4K of 206.6K placed ·
  40 of 316.8K edges*. Hovering "placed" names the two columns. A layout's sentence is unchanged.
- **`GraphLegend` reads *placed of total* on a map** — *Organisation 33,447 of 35,122* — and a
  category with no position at all moves into a muted **No position** group with its whole count
  and a hollow glyph, instead of reading 0. Under the filter a placed row keeps its *n of m*. When
  no relation has both ends on the map, a line under the rows says so.
- **`Drawn` carries `totals`, `links` and `placedLinks`**: per rank every vertex of the corpus,
  every loaded relation, and the relations whose two ends have a position.
- **A vertex with only one of the two values is unplaced.** It used to count as placed while
  cosmos.gl drew nothing for it.
- `GraphCanvasHarness.counts()` finds the map's filtered sentence, which has no "nodes" in it.
- The graph's size budget goes from 23.5 kB to 24 kB: measured 23.41 kB on `main` and 23.84 kB
  with this change, after compacting the legend's rows into one renderer.
