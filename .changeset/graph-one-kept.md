---
"@kanzo-tech/graph": minor
---

**What is kept is read once, and a match is a vertex the canvas draws.** Every clause on the page —
the canvas's own lasso, marquee or click included — narrows one mask, and the canvas's colour, its
labels, the counts, the legend, the toolbar and `frame()` all read it (`/docs/design/crossfilter`).

- **`GraphSnapshot.mask` is `GraphSnapshot.kept`.** `mask` was the page's filter *without* the
  canvas's own clause; `kept` is what every clause keeps, the canvas's included, and `null` when no
  clause is set. A host or test that read `getSnapshot().mask` reads `kept`; one that relied on it
  leaving the canvas's pick out narrows `kept` itself no longer — it already is.
- **`GraphStore.visible()` returns only kept vertices that have a position**, ascending. Under a
  layout every vertex has one, so nothing changes there.
- **Under bound positions, *match* counts kept vertices the map places.** The counts read *N match ·
  P of T placed*; a kept vertex with no `x` or `y` is no longer among the *N*, and `frame()` no longer
  tries to fit it. On the Nobel map a window used to count prizes with no affiliation that are
  nowhere on the canvas.
- **The labels name only what is kept.** Under a lasso, a vertex outside it is no longer labelled
  while it is drawn greyed.

The graph's size is unchanged against its 24.1 kB budget (24.08 kB measured).
