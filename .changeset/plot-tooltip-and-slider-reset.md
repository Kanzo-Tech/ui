---
"@kanzo-tech/ui": patch
---

**Two chart defects that only showed up in a real dashboard: an unreadable tooltip in dark mode, and a slider that survived "Clear filters".**

Observable Plot hardcodes `--plot-background: white` on its own `<svg>` and paints every floating surface with it — the `tip` box, `crosshair` haloes, `marker` fills — while drawing their text with `currentColor`. Inheriting `text-foreground`, as `TokenizedPlot` does so axes stay legible, therefore produced a white box with white text the moment the theme went dark: the tooltip was there and unreadable. `styles.css` now re-tokenises the variable to `--popover`, the same move `.kanzo-prose` makes for the typography plugin. It has to be set on the svg rather than on our container: Plot's rule is `:where(.plot-…)`, which has zero specificity but is still a declaration on that element, and a declaration always beats an inherited value.

`ChartSlider` ignored an externally cleared selection. It only copied `selected` into its thumbs when the value was defined, so a `Selection.reset()` — a "Clear filters" button, another control retracting the clause — removed the filter and left the thumbs where they were: a slider reading 5–22 while nothing was filtered. It now falls back to the queried extent, gated so the first render still honours `defaultValue`.

`TokenizedPlot` also committed every width its `ResizeObserver` reported. The width is a plot option, so each value rebuilt the plot — and a rebuilt plot builds fresh Mosaic clients, which re-query the database. One drag of a window edge or a splitter was therefore one query per pixel. The first measurement still lands immediately; after that the width waits for the drag to stop.
