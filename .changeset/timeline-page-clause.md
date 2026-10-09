---
"@kanzo-tech/mosaic": minor
"@kanzo-tech/ui": patch
"@kanzo-tech/graph": patch
---

**The graph's timeline no longer breaks the page beside it, and its window sticks to the bars.**

`GraphTimeline` published its window, `date BETWEEN …`, straight into the page's crossfilter, so
every other client of the page was handed a column only the types with a date have: a dashboard's
relation, its readout and a filter over a type without the column failed with a DuckDB binder error.
The window is now a clause of the timeline's own, crossed into the page by the new `antiJoinOf(key,
table)` in `@kanzo-tech/mosaic` — `key NOT IN (SELECT key FROM table WHERE NOT <the window>)`, the
companion of `semiJoinOf`. It names the key alone, so every client answers it; the types with the
column are filtered and the rest stay whole, as before in the graph, and a dashboard is filtered
through its relation's root. The chip still reads *date 1910 – 1940*.

`ChartTimeline`'s window sticks to the nearest edges of its bars when a drag ends (Cosmograph's
`stickySelection`), at least one bar wide, so it and its chip read *1910 – 1940* rather than
*1912.0 – 1938.6*; playing moves each end to the next edge, one real bar a tick. A year on its axis
reads *1900*, not *1,900*.

Size budgets raised as a decision: analytics 33.4 → 33.9 kB, one dashboard 31.8 → 32.3 kB.
