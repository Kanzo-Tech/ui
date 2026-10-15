---
"@kanzo-tech/ui": minor
---

Every `ChartRoot` now has a text alternative. A screen reader meets a table of what the chart drew,
named by the chart's `aria-label`, in place of the picture, which is hidden from assistive
technology. Where a crossfiltered chart draws a kept layer over a context layer, both are columns
(the context one as "(all rows)"). Past 50 rows the table is a summary: how many marks, the largest
and the smallest. The table follows the settled answer, not each step of a brush. It is visually
hidden; give the chart an `aria-label` so the table has a caption.
