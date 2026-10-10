---
"@kanzo-tech/ui": minor
"@kanzo-tech/graph": minor
"@kanzo-tech/mosaic": minor
---

**The timeline holds one window, reads it once, greys everything outside it, plays inside the
brushed range and draws its first year whole.**

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
- **Play runs inside the brushed range, accumulating.** The range you brush never moves: play
  publishes *[its start, one bar further]* until it holds the whole range, so the graph fills in over
  time (Kepler's `incremental` window). With no range Play is disabled, described and titled *Brush a
  range to play*. At the end it stops with the whole range kept, and the next Play starts over from
  its first bar. A pointer down on the bars pauses it, and a drag makes a new range for the next Play.
  Each step waits for the page to answer the last — new `paceBy` prop, the page's crossfilter by
  default; `GraphTimeline` passes its page — and takes 50 ms at least on 60 bars, longer on fewer,
  500 ms under `prefers-reduced-motion`. Space on the focused timeline plays and pauses; a pause and
  the end are announced.
- **While it plays, its chip in the `FilterBar` reads the window as it grows**, as it reads paused,
  and the chip's × stops play and lets the range go.
- **The timeline is a compact band, as in Cosmograph's app.** It is 44 px tall by default (was 72),
  with the tick labels at the top, each right of a thin rule through the band, and the bars under
  them. With no range the bars are a low-contrast fill and a range is bright. The graph docs' example
  no longer puts a border on it.
- **Play is a bare glyph at the timeline's left edge, with no box, muted until hovered or focused, as in Cosmograph,** named
  and titled *Play time* (*Pause time* while playing), so it no longer reads as the canvas toolbar's
  layout play button. The bars take the rest of the width: the window's range is no longer drawn
  beside them (the chip reads it), and *Drag across the bars to choose a window* is gone. The window
  is still read by assistive technology, as before. A test that found the button by the name *Play*
  or *Pause* finds it by *Play time* or *Pause time*; `TimelineHarness` already matches both, and its
  API is unchanged.

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
- **The window is in colour and the rest is grey, and a drag no longer flickers.** The bars above
  are clipped to the window rather than re-queried for it, so dragging the brush redraws nothing,
  and the brush draws as an outline rather than a grey fill over the bars it keeps.
- **The first tick reads *1980*, not *980*.** The plot leaves half a label of room at either end.

- **`GraphTimeline` is part of the graph's load.** Its band holds its height from the first render,
  and the graph reads *Loading* until the canvas and the timeline's bars have both drawn, then shows
  them together. A column chosen or changed later waits in the band alone.

Size budgets raised as a decision, for one clause source per brush across rebuilds and the
window's clip: analytics 33.9 → 35.6 kB, one dashboard 32.3 → 33.9 kB (the last 0.8 kB of each for play inside
the range).
