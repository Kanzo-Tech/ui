---
"@kanzo-tech/ui": minor
"@kanzo-tech/theme": minor
---

**Appearance is Light or Dark, picked by the user — the OS is no longer asked.** `appearance` is
`"light" | "dark"` and defaults to `"light"`; a host moves the starting side with
`policy.theme.appearance.default`. Removed: the `""` "follow the OS" value and the `AppearancePref`
type, `prefers-color-scheme` in `KanzoThemeProvider` and `themeScript`, `resolvedAppearance` (read
`appearance`, which is now always the side worn), and the `appearance` controller prop with its
`AppearanceController` type. A stored value that is not a side resolves to the default.

**`ThemePicker` is laid out as GitHub's Appearance settings.** A *Light · Dark* segment picks the
side, and two cards always follow — **Light theme** and **Dark theme**, side by side or stacked in a
narrow container — each with one large `ThemePreview` of its choice, the theme's name, and a row of
round swatches painted by each theme's real `--background` and `--primary`. Choosing a swatch files
that side's theme and never flips the appearance; the card of the side worn carries **Active**.
`ThemePickerCopy` is now `appearance`, `light`, `dark`, `day`, `dayDescription`, `night`,
`nightDescription`, `active`, `retired`.

**A scoped theme no longer inherits the page's optional tokens.** A light preview on a dark page drew
the dark theme's sidebar and popover, because a theme that leaves `--popover`, `--sidebar` or another
optional token unsaid inherited the page's value. Every `[data-theme]` element now resets them, so
the bridge's fallback resolves against the theme on that element.
