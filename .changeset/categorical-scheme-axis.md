---
"@kanzo-tech/theme": minor
"@kanzo-tech/ui": minor
---

**The categorical palette becomes a theme axis, and stops being three palettes that disagreed.**

`--chart-*` was the one colour axis Preferences never owned: a static block in the generator, so
`base` and `accent` never reached it and nobody had ever chosen it. Measured against the product's
own surfaces with the dataviz validator, it failed in both modes — in light, `--chart-4` and
`--chart-5` were two adjacent ambers at normal-vision ΔE 7.4 (the hard floor is 15, so two
categorical slots were indistinguishable to full-colour vision), `--chart-3` sat below the chroma
floor and read as grey, and three slots were under 3:1 on the surface. Beside it, `charts/theme.ts`
carried eight hardcoded hues that were a *different* palette, sitting in the CVD floor band at 6.1.
The same series was one colour through `ChartConfig` and another through a token.

There is now a **scheme**: the ordered set of colours that carry identity, `{ light, dark }`, eight
slots, held as data in `theme-data.json` and projected twice — into `--chart-1..8` and into the
library's `CHART_SCHEME`. One source, two outputs, so a chart keeps its colours where the theme CSS
is not loaded and the two can no longer drift (a test asserts they match). Eight because
d3/Plot categorical schemes run 8–12 and never 5; the 5 was shadcn's UI-token convention leaking
into data visualisation. The default scheme was derived by enumerating Tailwind's families, steps
and orderings against the validator, and clears every check in both modes: worst adjacent CVD ΔE
20.9, normal-vision 24.7, all eight at or above 3:1, all-pairs cap 3 slots.

Additional schemes are a `[data-chart-scheme]` block, following `data-base` and `data-accent` — the
attribute is `data-chart-scheme`, not `data-scheme`, which would collide with CSS `color-scheme` on
an element that also carries `.dark`.

Two schemes ship. `kanzo` is the default and asks nothing of the chart around it. `vivid` is the
same eight hues at the highest chroma that still clears every gate — the register the graph's
Nebula look used to keep to itself, now available to charts and tables too; on a light surface three
of its slots land under 3:1, so it carries the relief obligation and the panel says so rather than
leaving it in a doc. `Preferences` gains a **Chart scheme** section beside Accent and Base, and
`Copy CSS` emits the slots, which a copied theme used to lose entirely.

Registering your own is `schemeColors` on the prefs — Vega's `vega.scheme(name, colors)` in this
system's idiom, and mode-aware, because a palette that clears the light lightness band will not
clear the dark one.

`resolveTokenColor` and `useThemeTick` are now exported from `/analytics`. Anything painting tokens
onto a canvas needs both, and the workspace graph had reimplemented them — its copy filtered the
mutation observer down to `class`, `style` and `data-theme`, so it silently stopped repainting the
day the theme grew a fourth colour axis. A filter is a list of the axes that existed when it was
written.

Breaking, for anyone reading the old names or relying on the old values:

- `CHART_CATEGORICAL` is replaced by `CHART_SCHEME` (`{ light, dark }`) and `CHART_SLOTS`.
- `categoricalColor(i)` returns the **token** `var(--chart-N)` rather than a baked hex, so one
  answer follows both the light/dark flip and the selected scheme. Past the last slot it returns
  `var(--muted-foreground)` instead of a hardcoded grey — it never cycles, because a ninth series
  wearing slot 1 would claim to be the first one.
- `--chart-1` … `--chart-5` keep their names but change value; `--chart-6` … `--chart-8` are new.
