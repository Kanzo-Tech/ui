---
"@kanzo-tech/theme": minor
---

**A palette declares its brand and its status colours, and so replaces the accent axis.**

The palette axis shipped owning surfaces and syntax but not `primary` or status, on the reasoning
that base16 nominates no primary and that its accent slots mean *variables*, *classes* and *strings*
— so taking `success` from `base0B` would let a palette announce success in whatever hue it uses for
literals. That reasoning is still right, and it argues for **declaring** these per palette, not for
leaving them on separate axes. daisyUI's theme owns `--color-primary` and the whole status family;
base16 is the data shape, daisyUI is the ownership model, and conflating the two was the mistake.

Every value comes from the source project's own guidance where it has any, and `provenance` records
which — `upstream`, `ecosystem` (a port convention) or `kanzo` (ours, where the source is silent).
A field rather than a comment, because the entire argument for declaring is that "says who?" has an
answer. Two findings worth not re-deriving: **Nord designates its own primary** — `nord.css` says of
nord8 "Main color for primary UI elements", so daisyUI's nord10 is simply wrong and fails contrast
(3.10) besides — and **Dracula designates no brand at all**, since "primary" and "brand" appear
nowhere in a spec scoped to syntax highlighting, so its pink is labelled `ecosystem`.

`statusRelief` is the sibling of `relief` and works the same way: declared, then re-measured by
`palettes.test.ts` against AA for the ink and 3:1 for the fill on the palette's own ground. Nord's
red is 3.05 there and even pure black only reaches 5.13; three of Catppuccin Latte's five cannot
carry AA in its published values. Those are properties of those palettes — inventing darker
Catppuccin colours would stop it being Catppuccin — so they are published rather than nudged. A
palette's **brand**, unlike its status, is a hard bar: an unreadable primary makes the palette
unusable, so that one fails rather than being declared.

Selecting a palette now moves `--primary`, `--ring`, `--sidebar-primary(-ring)` and the four status
families along with the surfaces. Verified in a browser as well as in tests: with `data-accent="blue"`
already set, adding `data-palette="dracula"` takes `--primary` to Dracula's pink and keeps it under
`.dark` and `data-base="slate"`.

One test in this change is worth reading for what it stopped asserting. The first attempt checked
that a status colour never coincides with the base16 slot of the same meaning, meaning to catch a
lazy positional mapping — but a well-designed palette's semantics *should* line up with base16's slot
hues, and Catppuccin coincides on all four while being documented upstream on all four. Coincidence
was evidence of nothing. What is checkable is how much we invented, so it now asserts that no
borrowed palette has more than one status role marked `kanzo`.
