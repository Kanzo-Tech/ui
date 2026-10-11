---
"@kanzo-tech/ui": minor
"@kanzo-tech/graph": minor
"@kanzo-tech/mosaic": minor
"@kanzo-tech/testing": minor
---

**One count on the page.** What the filters keep was drawn up to four times on one screen: by the toolbar, the legend, the footer and each lasso or search chip. It is drawn once now, by the `FilterBar` readout, which moves to the start of the filter row (*611 of 1,528 people*), as dc.js's `dataCount` and Kibana Discover's hit count do.

- `FilterBar` draws its readout first, before the chips. Give it `relation` (and `rowNoun`) to have one.
- `GraphCounts` says what is drawn: *5K nodes · 8K edges*, or on a map *3K of 5K nodes placed · 1K of 8K edges*, plus *M hidden by other filters* when the canvas's pick holds vertices another filter hides. It no longer says *N match*.
- `GraphLegend` is a key, glyph and name, with no counts.
- A semi-join's chip is its label alone: *Lasso*, *"country:Spain"*, a rule's name, no longer *Lasso · 31 selected*. `clauseLabel` and `clauseParts` read it the same way.
- The automatic dashboard no longer opens with a *Rows* tile.

What to change: a test that read *N match* from `GraphCounts`, a count from the legend, or *· N selected* from a semi-join's chip reads `FilterBarHarness.readout()` instead.

`GraphCanvasHarness.counts()` reads the new sentence; what the filters keep is `FilterBarHarness.readout()`.
