---
"@kanzo-tech/ui": patch
---

**`ThemePicker` is laid out as GitHub's Appearance settings: two cards and a row of swatches, not a
card per theme.** *Theme mode* is now a select, with a line beside it saying what the mode does. In
sync mode a **Light theme** card and a **Dark theme** card sit side by side (stacked in a narrow
container), each showing one large `ThemePreview` of its choice, the theme's name, and a row of round
swatches — one per theme of that side, each its real `--background` and `--primary` split on the
diagonal. The card on screen carries **Active** in its header. Single mode is one **Theme** card whose
swatches are every theme on offer; choosing one still wears its side. Policy, the retired-theme notice
and keyboard behaviour (arrow keys within a row) are unchanged.

`ThemePickerCopy` gains `syncDescription`, `singleDescription`, `dayDescription` and
`nightDescription`, and `day` / `night` now default to "Light theme" / "Dark theme". A translation
that set only the old keys keeps working, with the four new lines in English until you add them.
