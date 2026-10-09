---
"@kanzo-tech/ui": minor
"@kanzo-tech/graph": minor
---

**A timeline: `ChartTimeline` in `@kanzo-tech/ui/analytics`, and `GraphTimeline` under the graph.**

`ChartTimeline` is a brushable histogram of one temporal column with a play button — Cosmograph's
`Timeline`, on the page's crossfilter. The window is one clause, a chip in the `FilterBar`; playing
moves it a bar every 50 ms through the interval's own `publish`, and stops at the end of the axis. It
is a figure named by its `title`, Play/Pause is `aria-pressed`, and the window is a group whose
`aria-valuetext` reads *1950 – 1960*, which is what `@kanzo-tech/testing`'s `TimelineHarness` drives.
A dashboard's temporal filter is this part now. `ChartRoot`'s context gains `plot()`, the vgplot
`Plot` on screen as `ChartPlot` (its `interactors`).

`GraphTimeline` is the timeline under the canvas, over every vertex table that has the column. The
column is a setting, not a prop: `time-by` — *Timeline* in the graph's settings, beside *X axis* and
*Group by* — offers the corpus's temporal columns, a `date`, a `timestamp`, or a column whose
`datatype` is `xsd:date`, `xsd:dateTime` or `xsd:gYear`. None, the default, draws no timeline.
`useGraphPrefs()` answers it as `timeline`.

**Requires a corpus attached by `@fossil-lang/corpus` 0.3.0-alpha.28 or later**: the graph reads
`fossil_columns.datatype`, which earlier versions do not write, and fails to read the structure
without it.

Size budgets raised as a decision: analytics 32.9 → 33.4 kB, one dashboard 31.5 → 31.8 kB, graph
23 → 23.5 kB.
