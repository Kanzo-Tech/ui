---
"@kanzo-tech/ui": minor
---

**Preferences can finally select a palette — and stops drawing its options three different ways.**

The palette axis was fully wired but unreachable: `data-palette` set the surfaces, the syntax roles,
`--primary` and the status families, and `.dark` followed from it, yet nothing in the panel could
choose one. Only the OS could reach a second palette.

`Preferences.Palette` is now the first section, because it is the primary colour choice. It is a
`RadioGroup` of cards — the value is a *name*, so a radio group is right and a colour picker is not
— each showing the palette's label and a `SwatchGroup` of its eight base16 accent slots. The
neutrals are left out on purpose: sixteen swatches in a 320px panel would be half greys.

It surfaces what the data already publishes rather than hiding it. A palette with no partner is
marked "dark only" and its appearance is pinned while selected; a palette carrying `relief` or
`statusRelief` is marked "low contrast", the same way the chart scheme says "· needs labels", inside
the labelled text so assistive technology hears it. And since the appearance toggle goes dead on a
pinned palette by design, the way back to following the OS lives here, on the axis that took it.

**Accent and Base presets are no longer behind a popover.** Five of the seven sections showed their
options without a click and these two were the exceptions, which is what made the panel feel like it
had three swatch idioms. `ColorPickerSwatchGroup` needs the picker context but not
`ColorPickerContent`, so the presets are legal as a direct child of the root; the popover stays for
the custom colour. The preset group also gained an accessible name, and each swatch an
`aria-label` naming the colour — Ark merges caller props last, so "Blue" now replaces the machine's
`select #155dfc as the color`.

Three fixes that were already broken:

- **`Reset` did not reset.** It hard-coded values instead of spreading `DEFAULT_PREFS`, so the chart
  scheme survived it, and the palette and appearance would have too.
- **`Copy CSS` silently dropped the palette** — the largest colour axis in the system — the same way
  it used to drop the scheme.
- **Five sections wrote their label twice**, visibly and again as an `aria-label`, which is the exact
  defect `PrefField` exists to prevent. A radio group cannot be labelled by a `Field` (one hidden
  input per item, so no single id to point at), so those sections now use `FieldSet`/`FieldLegend`,
  which is what `radio-group.tsx` already said was the right container.
