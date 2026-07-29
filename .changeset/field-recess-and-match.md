---
"@kanzo-tech/palette": minor
"@kanzo-tech/theme": minor
"@kanzo-tech/ui": minor
---

`--field` is a recess, and a search hit is a `--match`

**`--field` binds to `recess`, a measured direction rather than an alpha step.** `--faint` (step 10)
is a field's placeholder ink and it missed AA in dark on every backdrop — 4.49:1 on the page, 4.37
on a card, 4.13 in a popover. Removing the fill entirely does not fix it: at alpha step 1 (byte 0) a
popover still reads 4.41, because a dark popover *is* neutral step 3 and the failure was never the
fill. A field sits *under* the surface that holds it, and in dark every alpha step composites
*lighter* than its ground, so the binding now names the direction and the ramp answers — the alpha
step where it recedes, step 1 (the page) where none does. Dark fields read 4.74:1 on all three.

The cost, stated: a dark field on the page is byte-identical to the page and is identified by
`--input` at 4.18:1, which is what WCAG 1.4.11 asks of a control boundary. `bg-field` still separates
where the surface is raised — ΔE 1.43 on a card, 4.65 in a popover or sidebar, against 3.09–3.74
before. Light is unchanged (ΔE 2.40, 4.83:1).

**`--kanzo-editor-search-match` → `--match`, `--kanzo-editor-search-active` → `--match-active`.**
Highlighting a search hit in an editor and a `<mark>` in prose are one decision, and the editor
prefix forced `Highlight` to borrow `--warning-wash-strong`, which says "warning" about something
that is not one. Not `--highlight`: Ark spells menu-item focus `data-highlighted` throughout this
library. `Highlight` now paints `bg-match`, and both tokens have `@theme inline` entries so they can
be spelled as utilities.
