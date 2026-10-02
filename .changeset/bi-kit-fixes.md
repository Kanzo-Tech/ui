---
"@kanzo-tech/ui": patch
---

**Four fixes to the analytics BI kit.**

- **The grids follow the dashboard's width, not the screen's.** `DashboardFilters` and `Dashboard`'s
  card grid lay out with container queries, so a dashboard beside a dock or in a pane gets the
  columns its own width allows, and a search filter no longer overflows a narrow cell. `ChartCard`'s
  `span` now applies inside a `Dashboard`'s grid, measured on the dashboard.
- **`DetailTable` formats a time by its column's type:** a `DATE` as a day (no time, and in UTC so
  it is not the day before west of Greenwich), a `TIMESTAMP` as its wall clock, a `TIMESTAMPTZ` in
  the viewer's zone, a `TIME` as it came.
- **A stacked area completes its grid.** `ChartAreaY` / `ChartAreaX` stacked by a series column draw
  a series that has no row at some step as zero there, instead of a jagged stack. This adds
  `@uwdata/mosaic-plot` (`^0.29.2`, already a dependency of `@uwdata/vgplot`) as an optional peer:
  **install it beside vgplot** (`pnpm add @uwdata/mosaic-plot`).
- **`plotRelation(table, { fields, columns })` is exported** — the relation and fields as the plots
  can read them, for a host composing the parts over a relation with columns named `x`/`y`.
