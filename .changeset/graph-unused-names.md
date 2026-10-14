---
"@kanzo-tech/graph": minor
---

`ShapeGlyph` (with `ShapeGlyphProps`), `scaleOf` and `placementFrom` leave `@kanzo-tech/graph`, none of them called by a host. A category's glyph and colour reach a page through `GraphLegend`, `GraphInspector` and `GraphSearch`, which draw them; the placement a preferences panel chose is `useGraphPrefs().placement`. `Channels` and `Placement` stay as types.
