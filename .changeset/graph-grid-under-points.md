---
"@kanzo-tech/graph": patch
---

**`GraphCanvas`'s dot grid is drawn under the points, not over them.** It used to sit on top of the
WebGL canvas, so every dot covered whatever point lay beneath it: a dense graph showed a dark lattice
across the points. cosmos.gl now clears to a transparent background, and the canvas element paints
the colour under it, `bg-background` by default. Nothing to edit. If you set a background on
`GraphCanvas` through `className`, it now shows behind the points too; until now cosmos.gl painted
`--background` over it.
