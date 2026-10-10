---
"@kanzo-tech/ui": patch
"@kanzo-tech/graph": patch
---

**The timeline holds one window, reads it once, greys what it leaves out and draws its first year
whole.**

- **A second brush replaces the window instead of adding one.** `bin()` made a new transform on
  every call, so each render of a chart that binned — `ChartTimeline`, a tile's histogram, your own
  `<ChartRectY x={bin("date")} />` — was a new plot, its queries re-run and its brush a new
  interactor: the old window stayed in the `FilterBar` beside the new one, and the two intersected.
  `bin` from `@kanzo-tech/ui/analytics` now returns the same transform for the same field and
  options. A plot that is rebuilt anyway — a resize, a theme change — hands each brush or pick to
  its successor, drawn where it was, and the page keeps one clause for it.
- **Play is never enabled over a window that is gone.** After a rebuild the button stayed enabled and
  did nothing; the window now survives the rebuild and plays. With no window it is disabled and
  described by the readout beside it, *Drag across the bars to choose a window*.
- **The chip reads *birthday 7/1/1981 – 7/1/1985***, not *birthday birthday …*: the `FilterBar` no
  longer prefixes a bridged part with its bridge's name when the part already reads as that name.
- **The window is in colour and the rest is grey.** The bars in front are filtered by the window,
  and the brush draws as an outline rather than a grey fill over the bars it keeps.
- **The first tick reads *1980*, not *980*.** The plot leaves half a label of room at either end.

Size budgets raised as a decision, for the hand-over a rebuilt plot owes its brushes: analytics
33.9 → 34.2 kB, one dashboard 32.3 → 32.5 kB.
