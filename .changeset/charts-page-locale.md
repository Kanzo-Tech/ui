---
"@kanzo-tech/ui": patch
---

The charts format their figures and dates in the page's locale — the one `LocaleProvider` sets — as
`FormatNumber` and every Ark part already did. `ChartRoot`'s `formatNumber`, the chart's text
alternative, `ChartTimeline`'s axis and window, `DetailTable`, `FilterBar`'s count and
`DashboardStat` read the browser's locale before, so a page in Spanish showed `1,234` in some places
and `1.234` in others. Without a `LocaleProvider` they now format in `en-US`, as Ark does; put one at
the root to choose. `ChartRoot`'s `locale` prop still overrides it for one chart.
