---
"@kanzo-tech/graph": minor
---

**The graph toolbar has one Frame, and its buttons no longer move.**

- **`fit()` is gone from `GraphApi` — call `frame()`.** With nothing greyed out, `frame()` frames the
  whole graph exactly as `fit()` did, and keeps it framed through a resize until the reader zooms or
  pans; with a filter or a lasso it frames what is in full colour, as before.
- **The toolbar's *Fit to view* is its Frame**, in the zoom cluster and always there. It is named for
  what it will frame: *Frame everything*, or *Frame what the filters keep*. A test that clicked
  `"Fit to view"` or `"Frame what is in full colour"` clicks one of those; `GraphCanvasHarness.frame()`
  finds either.
- **The selection's × is gone.** A lasso or a marquee is a chip in the `FilterBar`, and Escape drops it;
  `api.clear()` still clears the selection from code.
- **The count is a readout, drawn first.** While something is greyed, *N of T* sits at the start of the
  row (the end of a vertical toolbar), so anchored at `end-2 top-2` it grows away from the buttons. Its
  group is named *In full colour* and its slot is `graph-toolbar-count`, where they were *Current
  selection* and `graph-toolbar-selection`; the zoom cluster is named *Camera*, where it was *Zoom and fit*.

The graph's root barrel is 24,079 B against its 24.1 kB budget (24,082 B before).
