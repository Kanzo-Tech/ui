---
"@kanzo-tech/ui": minor
---

**`/charts` gains facets, 34 more marks, and inputs that wear our components.**

**Facets.** `ChartFacetX` / `ChartFacetY` configure the `fx` / `fy` scales (domain, padding, axis,
label, tickRotate, grid, reverse), with `facetMargin`, `facetGrid` and `facetLabel` on `ChartRoot`
for the plot-wide half. The channels themselves already worked on any mark — `<ChartBarY fx="region" />`
is small multiples. Facets compile to **attributes, not marks**, for the same reason axes do: an
interactor binds to the last mark added, so a facet-axis mark would steal that binding.

**Marks.** 34 wrappers added — waffle, contour, raster/rasterTile, denseLine, vector/spike,
arrow/link, voronoi/hull/delaunay, geo/sphere/graticule, image, the 2D `density`, `errorbarX`, and
the missing X/Y variants. `ChartHexgrid`, `ChartSphere` and `ChartGraticule` are decorators (options,
no data), matching vgplot's own set.

`ChartVectorX` is wrapped but does nothing: vgplot 0.29.2 builds it as `mark('vectoX', …)` — an
upstream typo, so the renderer looks up a Plot mark that does not exist. Use `ChartVector`; ours
starts working the day upstream fixes it.

**Inputs.** `ChartFilter`, `ChartSearch` and `ChartSlider` publish into a `Selection` without being
charts. vgplot renders its own with raw HTML; these are the same clauses wearing our `FacetFilter`,
`Input` and `Slider`. `ChartSlider` offers a real two-thumb interval where vgplot only has a
one-sided range. All three retract their clause on unmount — `Selection.remove()` returns a *clone*,
so the only way to withdraw from a live selection is to publish an empty clause.

**Clicking a bar now shows something.** A cross-filtered `Selection` hides a clause from the client
that published it, which is what stops a chart filtering itself away — but it also meant the chart
that received the click was the only one that could not react to it, so toggling a category produced
no visual response at all. `MosaicProvider` now creates two paired selections: interactors publish
into `selected` (a plain union), which is relayed into `crossfilter` via `include`. Other charts
filter exactly as before, the source chart still does not self-filter, and `ChartHighlight` finally
sees the clause. The pairing lives in the provider because `include` is constructor-only.
`useSelected()` exposes it.
