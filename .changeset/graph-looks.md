---
"@kanzo-tech/graph": minor
---

**`GraphLooks`: the graph's picture as three looks and the axes under them.** A new part for a
preferences panel or a dock: Nebula, Atlas and Ink as cards with live miniatures, and the axes
folded under "Customize" — Marks as a segmented control, the rest as `GRAPH_SECTION` declares them.
It needs `GRAPH_SECTION` among the provider's `sections` (without it, it draws nothing) and no
`GraphRoot`. `useGraphPrefs()` now also answers `preset` — `"nebula" | "atlas" | "ink" | null`, typed
`LookPreset` — so a host can pair channels with a look, e.g. Ink with `fill="var(--foreground)"` and
`symbol` on the category. If you hand-built look cards over the section, `<GraphLooks />` replaces
them.
