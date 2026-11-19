---
"@kanzo-tech/ui": patch
---

`ChartColorLegend` now sits under the plot instead of beside it. Beside it, the legend's width was taken out of the plot, which then drew its axes and labels shrunk to fit — 11px text came out near 6px on a narrow card. The plot keeps the full width of its container now, and the chart is taller by the legend's row.
