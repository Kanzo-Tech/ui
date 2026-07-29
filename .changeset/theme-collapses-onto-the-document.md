---
"@kanzo-tech/theme": major
---

**`packages/theme` collapses onto the tenant palette document.** This is the deletion wave the
document core was built for: colour stops being four runtime axes and becomes one artefact.

`themes.css` goes from 53,963 bytes to 1,913 — it now emits `[data-radius]`, `[data-font]`,
`[data-mono-font]` and `[data-font-size]`, and nothing else. `[data-base]`, `[data-accent]`,
`[data-palette]` and `[data-chart-scheme]` are gone, along with the ten neutral scales, the
eighteen accents, the six palette blocks and the `--color-mauve-*` custom scales that fed them.
Each was a way to express *part* of a palette at runtime; a document expresses all of it at once,
before a byte is sent. `theme-data.json` drops from 74,197 to 9,102: `bases`, `accents`,
`curatedAccents`, `accentSwatches`, `staticLight`, `staticDark` and `defaultPalette` were all
tables about those axes.

**The default tenant is not a special case.** `palettes/kanzo.json` is a tenant whose document
happens to be committed — `derivePalette` applied to two seeds (`#737373` for both brand and
neutral, because this system has no chromatic brand and never had one) by exactly the code a
client's document goes through. `tokens.css`'s colour half is that document compiled, so the two
hand-written `:root`/`.dark` blocks and their `color-mix` chains are gone and there is no
hand-written hex left in the package. A test asserts the section is byte-for-byte
`compile(kanzo.json)` and that nothing above the marker matches `#rrggbb`, `color-mix(` or
`oklch(`.

**base16 palettes are demoted to seeds.** Dracula, Nord and Catppuccin Latte/Mocha are brand +
neutral pairs in `themeData.seeds`, derived like any client's. The neutral is `base03` by rule
rather than transcription — base16 orders base00–base05 background → ink, so base03 is the
mid-tone of the source's own neutral ramp, and for Kanzo it lands exactly on `neutral-500`. The
old rule ("a palette may be dark-only; do not invent a light side for Dracula") was true when a
palette was a set of authored hexes and is not true under derivation: a ramp keeps a foreign seed's
*hue* and loses its mood, so a light Dracula is a reading, not an invention. Measured, Dracula's
`#50fa7b` comes back as `#00a843` at step 9 — same hue, different place. `appearance`, `pairsWith`,
`PALETTE_PAIRS`, `resolvePalette` and `paletteAppearance` die with them: a document carries both
modes, so there is no pair to resolve.

Removed exports: `SCHEMES`, `PALETTE_PAIRS`, `CHART_SLOT_VARS`, `PRIMARY_OVERRIDE`,
`PRIMARY_FG_OVERRIDE`, `resolvePalette`, `paletteAppearance`, and the types `Palette`,
`PaletteSlot`, `PaletteRole`, `RoleProvenance`, `KanzoPalette`, `KanzoBase`, `KanzoAccent`,
`CuratedAccent`, `KanzoScheme`, `Scheme`, `SchemeColors`, `StatusRole`. `ThemePrefs` ends as
`{ appearance, radius, font, monoFont, density }` — colour is client identity, not user preference.
`PALETTES` survives, reduced to `{ label, slots }`: the authored strips still feed the 13
Kanzo-fixed syntax roles and the showcase that puts an original beside its derived result.

`palettes.test.ts` loses nine tests about pairing, declared appearance, declared brand/status
roles, provenance and manufactured base06/07 slots — none of those concepts exists any more. What
survived was re-pointed rather than deleted: the on-fill-ink AA measurement that caught
`text-white` at 2.13:1 now measures the document's derived `--*-content` on `--*` for every shipped
identity in both modes, and the "a palette's brand is a hard bar" rule now measures `--primary` on
the tenant's own page.
