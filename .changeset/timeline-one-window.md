---
"@kanzo-tech/ui": minor
"@kanzo-tech/graph": minor
"@kanzo-tech/mosaic": minor
---

**The timeline holds one window, reads it once, greys everything outside it, sweeps the whole axis
when played and draws its first year whole.**

- **While a window is set, only what has the time column and falls in the window stays in colour.**
  `GraphTimeline` used to leave every type without the column whole, so a window over 30 birthdays
  read *340,163 of 341,661*; it now reads *30 of 341,661*, as Cosmograph greys them, and edges grey
  with their ends. A dashboard over a relation whose root has no such column shows **no rows** while
  the window is set — its chip, *birthday 1981 – 1985*, names why, and removing it brings them back.
  If you counted on the old behaviour, there is no switch: the window is a filter on time, and what
  has no time is outside it.
- **`antiJoinOf` is gone from `@kanzo-tech/mosaic`.** The timeline was its only user and now crosses
  with `semiJoinOf(key, table)`. Replace a call with `semiJoinOf` if you want rows the table does not
  hold dropped, which is what it now does for the timeline.
- **Play sweeps the whole axis.** With no window it starts one a bar wide at the start of the axis and
  moves it a bar at a time to the end, then stops; with a window it moves that window, its width kept,
  from where it is. Pause leaves the window where it is. Play is never disabled while there are bars.
  Under `prefers-reduced-motion` it moves a bar every 500 ms instead of every 50.
- **Play is a round icon at the timeline's left edge, as in Cosmograph.** It is named *Play time* (and
  *Pause time* while playing), the same words as its tooltip, so it no longer reads as the canvas
  toolbar's layout play button. The window's range reads at the right edge in a slot of fixed width,
  empty with no window: *Drag across the bars to choose a window* is gone. A test
  that found it by the name *Play* or *Pause* finds it by *Play time* or *Pause time*;
  `TimelineHarness` already matches both, and its API is unchanged.

- **A second brush replaces the window instead of adding one.** `bin()` made a new transform on
  every call, so each render of a chart that binned — `ChartTimeline`, a tile's histogram, your own
  `<ChartRectY x={bin("date")} />` — was a new plot, its queries re-run and its brush a new
  interactor: the old window stayed in the `FilterBar` beside the new one, and the two intersected.
  `bin` from `@kanzo-tech/ui/analytics` now returns the same transform for the same field and
  options. A plot that is rebuilt anyway — a resize, a theme change — keeps one clause source per
  brush or pick for the chart's whole life, so whoever publishes, during a drag or while the
  timeline plays, the page holds one clause and one chip for it; the new brush is drawn where the
  old one was.
- **Play is never inert over a window that is gone.** After a rebuild the button stayed enabled and
  did nothing; the window now survives the rebuild and plays.
- **The chip reads *birthday 7/1/1981 – 7/1/1985***, not *birthday birthday …*: the `FilterBar` no
  longer prefixes a bridged part with its bridge's name when the part already reads as that name.
- **The window is in colour and the rest is grey, and a drag no longer flickers.** The bars in front
  are clipped to the window rather than re-queried for it, so dragging the brush redraws nothing,
  and the brush draws as an outline rather than a grey fill over the bars it keeps.
- **The first tick reads *1980*, not *980*.** The plot leaves half a label of room at either end.

Size budgets raised as a decision, for one clause source per brush across rebuilds and the
window's clip: analytics 33.9 → 34.8 kB, one dashboard 32.3 → 33.1 kB.
