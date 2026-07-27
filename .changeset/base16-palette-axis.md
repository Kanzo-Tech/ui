---
"@kanzo-tech/theme": minor
"@kanzo-tech/ui": patch
---

**A palette is the colour identity — `data-palette`, in base16.**

The theme had four colour axes a product was expected to cross by hand: a neutral `base`, an
`accent`, a chart `scheme`, and a light/dark toggle that belonged to none of them. Nobody wants to
compose those. They want *Dracula*. The reference for that shape is daisyUI, where the theme is the
user-facing choice and `color-scheme` is a property of it rather than a second axis crossed with it.

There is now a **palette**: one named object from which the surfaces, the neutrals and all 13
`--kanzo-syntax-*` roles follow. Six ship — `kanzo` and `kanzo-dark`, `dracula`, `nord`,
`catppuccin-latte` and `catppuccin-mocha` — as `[data-palette="…"]` blocks alongside `data-base` and
`data-accent`, and as data in `theme-data.json` so a panel can render the strip a palette *is*.

The shape is **base16**: sixteen slots with documented roles, `base00`–`base07` neutrals and
`base08`–`base0F` accents. That is the format these palettes already exist in, and `tokens.css` had
independently grown exactly the 13 syntax roles base16 was designed to map. The palette is the data
and the role mapping is separate, which is what lets one palette dress an editor and a UI without
either owning the other.

A palette **carries its own appearance**. It emits `color-scheme`, so selecting a dark one darkens
form controls and scrollbars without a mode being chosen alongside it, and it declares `pairsWith` —
the partner palette of the same identity, or `null`. Pairing is what the light/dark dichotomy folds
into: `prefers-color-scheme` selects the partner rather than inverting a mode. Dracula has no
partner, because it is dark-first and should not have a light side invented for it.

Every palette publishes its **relief**: the slots that do not clear WCAG AA *as text* on their own
`base00`, declared in the generator and re-measured by a test. It reads differently than a scheme's
relief — a chart slot is a mark, so 3:1 plus direct labels is a documented relax, but every base16
slot renders as small text, so the bar is 4.5:1 and there is nothing to trade. The numbers are
properties of the palettes themselves, not of the mapping: Nord's comments are 1.7:1 in Nord, and
Catppuccin Latte is low-contrast by design with eight slots under the bar. `kanzo` and `kanzo-dark`
clear everything, and a test holds them there.

What a palette deliberately does **not** own, each for its own reason: `accent`/`primary`, because
base16 nominates no primary and taking one would be inventing brand from a syntax slot; status
colours, because base16's red/yellow/green slots mean *strings* and *classes*, so wiring them across
would let a palette say "this succeeded" in whatever hue it uses for literals; and the chart scheme,
which is **derived** rather than mapped — `deriveScheme` exists precisely because no named palette
passes the categorical checks in its own values.

The 13 syntax roles now follow the base16 styling guidelines rather than hand-picked hues, which
moves seven of them in the default theme (identifier teal→`base08`, type blue→`base0A`, function
rose→`base0D`, property sky→`base0C`, url indigo→`base0D`, invalid →`base0F`, number amber→`base09`),
and swaps comment/punctuation so the neutral ramp runs monotonically from background to ink as the
spec requires. A mapping tuned to our own hues would only ever look right in our own palette. Taking
`tokens.css`'s previous shades straight into the ramp also put light-mode comments at 2.5:1, which
the new ordering fixes. `tokens.css` now carries the `kanzo` pair's slots as literal hex, the way
`--chart-*` already did, and a test asserts the two projections agree — otherwise *selecting* Kanzo
would recolour an editor that was already showing Kanzo.

Also fixed: `KanzoThemeProvider`'s attribute effect lists its dependencies field by field, so adding
an axis to `AXES` did not add it to the deps — the axis would apply on first mount and then never
update again, with no type error. A test now checks every axis is watched.

`ThemePrefs` gains a required `palette`, defaulting to `kanzo`.
