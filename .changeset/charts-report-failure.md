---
"@kanzo-tech/ui": minor
---

**A chart whose query fails says so, and tells you.** A failed query used to leave a chart blank or
on its last render, a `ChartStat` on its skeleton and a `ChartFilter` on "Loading…" for good. Now
`ChartRoot` reads *This chart could not be drawn.* in its own frame, `ChartStat` shows a dash, and
`ChartFilter` says its values could not be read. `MosaicProvider` takes `onFailure(error: unknown)`,
called with the thrown value from every chart, stat and input beneath it — pass it to your failure
view and branch on `error.code`. `useChartQuery` and `useMosaicInput` return it as `error`.
