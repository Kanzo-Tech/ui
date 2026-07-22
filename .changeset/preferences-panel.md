---
"@kanzo-tech/ui": minor
---

Preferences panel: canonical footer (separator + Reset / Copy CSS / Done) and the close button
moved to the canonical absolute placement. New density preview cards (parity with the font
specimens). Fixes: "Copy theme CSS" now reproduces exactly what's applied (custom primary,
font, mono font and density were ignored before); the base swatches no longer render blank in
light mode; and Dialog/Popover titles reserve inline-end room so the close X never overlaps them.
