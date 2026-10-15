---
"@kanzo-tech/ui": minor
"@kanzo-tech/testing": minor
---

`ChartRoot` no longer registers itself with `window.__KANZO_TESTING__`: production code reads no test
global for charts any more. `ChartHarness` reads where a value falls from the scale Observable Plot
puts on the chart it drew, so `brush` and `pick` work as before. `KanzoTestingHook.charts` and the
`ChartProbe` type are removed from `@kanzo-tech/testing`; if you read `hook.charts`, read the scale
off the chart's Plot output instead.
