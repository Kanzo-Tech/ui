---
"@kanzo-tech/theme": minor
"@kanzo-tech/ui": minor
---

**`--input` was two roles under one name. The fill half becomes `--field`, and stops being an opacity.**

Counted rather than estimated: 23 sites drew a control *outline* with it (`border border-input`,
plus one `1px solid var(--input)` in `CodeEditor`) and 26 drew a control *fill* (`bg-input/30`,
`/32`, `/64`, `/4`, and solid `bg-input` in `separator`, `progress` and `switch`). WCAG 1.4.11 asks
3:1 of the first — it is the visual boundary that identifies an interactive component — and nothing
of the second. `border-input` measures **1.33:1**, so the outline has to move, and it could not
while the fills rode on the same value: at the boundary step they become slabs, at the surface step
the outline still fails. One token cannot answer two rules.

`--field` is `(neutral, alpha 3)`, derived with `deriveRamp` from the seed `#737373` — which is this
theme's own neutral, its ramp's step 1 landing exactly on `--background` in each mode. The
derivation is quoted beside the value in `tokens.css`; a hand-picked hex here would be the defect
the ramp exists to prevent.

The `/NN` goes with it, and that is the substantive half. `bg-x/60` dilutes a solid **toward
transparent**, so where it lands is a function of whatever is painted underneath and it agrees with
the ramp's own step only over a white page. An alpha step is solved to composite onto its solid over
the real page, so it is the same colour there and shows through honestly over anything else — a
graph canvas, a chart, an image. `alpha-steps.test.ts` bans re-diluting one.

**Focus rings go solid.** `ring-ring/32` — 37 spellings across 29 files, every focus ring in the
library — becomes `ring-ring`. Measured, the diluted form was **1.29:1** in light and 1.42:1 in
dark, a live 1.4.11 failure on the thing 1.4.11 names first; the solid ring sits at the ramp's own
boundary step, 4.41:1 and 4.06:1.

A second token, `--ring-soft` = `(brand, alpha[boundary])`, was tried for those sites and **dropped
before shipping** — and the measurement that killed it is worth more than the token was. An alpha
step's entire obligation is that it composites back to its own solid over step 1, so on a page
`ring-ring-soft` *is* `ring-ring`, by construction. Reproduced: `#8e51ff` light, boundary 9, solid
`#8e51ff`, alpha `#5500ffa7`, composited `#8e56ff`; the shipped neutral `#737373` light, solid
`#737373`, alpha `#00000088`, composited `#757575`. It differed only over content the theme does not
own, which a focus ring never needs, and it cost the accent hue: `--ring` is re-pointed 42 times in
`themes.css` by `data-accent` / `data-palette`, and a static alpha is not. Two tokens for one
decision is exactly the defect this layer exists to remove — `--secondary`/`--muted`/`--accent`
being byte-identical is the original sin. The `ring-ring/NN` ban stays; that is the real rule.

One more thing worth seeing before merging the theme layer: the three **solid** `bg-input` fills —
separator, progress track, unchecked switch track — sat at ramp step 5 (1.33:1) and now sit at step
3 (1.07:1). That is what the role table says a fill is, but a separator is a border and a track
reads as one, so they are the candidates for `--border` (step 6) when it moves.
