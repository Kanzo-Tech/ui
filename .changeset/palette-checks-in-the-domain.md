---
"@kanzo-tech/theme": minor
---

**The categorical-palette checks become executable specification, inside the package that owns the
colours.**

`--chart-*` shipped broken for as long as it did because no code could answer "is this palette
legal?". The rule lived in a document; the measurement was something a person did once, by hand.
`checkScheme(colours, { mode })` now answers it: OKLCH lightness band, chroma floor, colour-blind
separation under Machado–Oliveira–Fernandes (2009) at severity 1.0, the unsimulated normal-vision
floor, and WCAG contrast against the surface. Pure — no DOM, no React, no CSS.

The thresholds ship with it and are calibrated to that simulation model: the model is part of the
standard, not an implementation detail, so swapping it would move borderline pairs and require
recalibrating the numbers.

Its own tests are the gate. Every registered scheme is checked in both modes, and each scheme's
declared `relief` count is asserted against what the checker measures — so a scheme that quietly
gains a sub-3:1 slot can no longer keep claiming it asks nothing of the chart around it. Two
regressions are encoded: the palette this replaced (two adjacent ambers at normal-vision ΔE 7.4 and
a slot below the chroma floor), and a palette borrowed from a syntax-highlighting theme, whose
accents all sit outside the dark lightness band — which is why a named palette can supply hues to a
derivation but never its values.
