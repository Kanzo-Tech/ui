# A chart fails silently and well-painted

- **Status** live — 2026-07-25
- **Decided** Chart work is verified in a browser against a real coordinator. A unit test is not
  evidence that a chart works.
- **Because** the failures this layer produces render cleanly: an empty plot with correct axes, a
  legend for a scale nothing uses, a brush that publishes into a selection no client reads. A
  DuckDB binder error surfaces as a chart with no marks, and jsdom has no DuckDB, so the test that
  covers the component passes.
- **Reversed by** a harness that can run the real coordinator headlessly and assert on marks
  rather than on React output.
- **Held by** `packages/ui/src/charts/chart-inputs.test.tsx` and
  `packages/ui/src/charts/chart-stat.test.tsx`, whose own headers state the limit — the coordinator
  is a double that plays the moves a real one makes

Two operational consequences. The docs app builds and serves charts under `--webpack` only; vgplot
trips a temporal-dead-zone error under Turbopack. And one coordinator serves a whole page: the
active-coordinator setter is process-wide, so a second one leaves the first page's charts empty.
Each `MosaicProvider` still owns its own selections, so one example's brush never reaches the next.
