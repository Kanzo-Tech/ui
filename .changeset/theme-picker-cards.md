---
"@kanzo-tech/ui": minor
---

**`ThemePicker`: the card is the selector.** The *Light · Dark* segment is gone. The two cards are
now one radio group, *Appearance*: clicking a card anywhere but on a swatch wears its side, and the
worn card is the checked one — primary border and *Active*. Each card still offers only its own
side's themes, and each side still remembers its own theme.

- **Pointing at a swatch previews it** in that card's preview and name only; the page does not
  change, and leaving puts the card's theme back.
- **Clicking a swatch commits it and wears that side**: choosing a dark theme while wearing light now
  switches to dark (it used to file the theme and leave the page light).
- **Keyboard**: arrow keys move between the cards (and wear the side, as radios do); within a card's
  swatches they move focus and preview without choosing, Enter or Space chooses, Escape restores the
  preview.
- **Policy**: a pinned or hidden appearance draws only the worn side's card; a pinned or hidden theme
  draws both cards without swatches, still choosing the side.

`ThemePickerCopy` loses `light` and `dark` — there is no segment to label. `appearance` stays, as
the cards' accessible name. Drop the two keys from your `copy`:

```diff
 <ThemePicker
   copy={{
     appearance: "Apariencia",
-    light: "Claro",
-    dark: "Oscuro",
     day: "Tema claro",
```

**`setTheme` called twice in one tick keeps both sides.** It merged onto the render's snapshot, so
filing a family's light and dark themes in one handler kept only the second.
