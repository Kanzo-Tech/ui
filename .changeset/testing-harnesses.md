---
"@kanzo-tech/testing": minor
"@kanzo-tech/ui": minor
"@kanzo-tech/graph": minor
---

**`@kanzo-tech/testing` is new: a harness per component, to drive a page built with Kanzo UI from a
test.** `GraphCanvasHarness`, `ChartHarness`, `TimelineHarness`, `DashboardHarness`,
`FilterBarHarness`, `AnswerHarness`, `FindingsHarness` and `DockHarness` find their component by its
ARIA and operate it — brush a chart *in data*, pick a bar by its value, lasso a graph over the points
you name — and wait on its state, never on a time. Make the environment before the page loads:
`const env = await playwright(page)` in Playwright, or `dom()` from `@kanzo-tech/testing/dom` before
`render` in a unit test. Install it as a dev dependency; it imports none of the components.

What the components now expose for it, which you may see in your own markup and snapshots:

- **`ChartRoot`** has `role="figure"`, named by the `aria-label` you pass (a dashboard tile passes its
  title), and is `aria-busy` until it has drawn and while a query runs.
- **`FilterBar`**'s readout is a `role="status"`, `aria-busy` while it counts, so a screen reader
  hears the new count when a filter changes.
- **`Dashboard`** is `aria-busy` while it reads the relation's fields.
- **`GraphCanvas`** is `aria-busy` until its first drawn frame, carries `data-frame` — the number of
  frames it has drawn — and always has an `id`: yours if you pass one, a generated one otherwise.

When a test installs `window.__KANZO_TESTING__`, `ChartRoot` and `GraphCanvas` register their scales
and their screen positions with it. A page never has it, and then they do nothing.
