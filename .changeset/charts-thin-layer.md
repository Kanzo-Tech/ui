---
"@kanzo-tech/ui": minor
---

**`/charts` is a composable grammar over Mosaic/vgplot, not five fixed chart types.**

`Histogram`, `BarChart`, `LineChart`, `ScatterPlot` and `BarSeriesChart` are **removed**. They were
five parallel hardcoded `vg.plot(...)` calls with overlapping props: a bar and a line could not
share a plot, and swapping `toggleX` for `intervalX` meant forking the component. vgplot is a
grammar (~40 marks, 19 interactors, ~250 attributes) and we were exposing it as five snapshots.
Each of the five is now a ten-line example in the docs, written with the layer below.

`ChartRoot` compiles its children into one `vg.plot(...)`. Children come in two kinds, and the
split is deliberate: **marks, interactors and axes are inert descriptors** (`ChartBarY`,
`ChartLineY`, `ChartRectY`, `ChartDot`, `ChartIntervalX`, `ChartToggleX`, `ChartAxisX`, …) that
render no DOM — vgplot paints an SVG imperatively, so there is nothing for an Ark-style part to
own — while **`ChartRoot` and `ChartLegend` are real DOM** with `ark.*`, `data-slot` and `asChild`.

`ChartConfig` (`{ series: { label, color } }`) pins the plot's colour scale and feeds marks, legend
and tooltip from one place; `--chart-*` tokens are resolved to Plot-safe `rgb(...)` at mount and on
every theme change. `useChart()` exposes `color(key)` and `formatNumber()` to DOM parts.

Wrapping is a convenience, never a cage: `<ChartRaw spec={vg.hexbin(…)} />` passes an unwrapped
directive through in source order, and `attributes` on the root applies raw `vg.*` attributes last.
The compiler is pure data (`{ kind: "mark", mark: "barY", … }`) mapped onto `vg.*` in a single
switch, so the grammar is unit-tested without a live coordinator.
