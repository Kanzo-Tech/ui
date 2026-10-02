---
"@kanzo-tech/theme": major
"@kanzo-tech/ui": major
---

Corner radius and typography are no longer user preferences. They come from the theme. A theme
declares `--radius-box`, `--radius-field` and `--radius-selector`, and may declare `--font-sans`,
`--font-heading` and `--font-mono`. A theme that names no face falls back to Geist and Geist Mono.

Removed:

- `@kanzo-tech/ui`: `PreferencesRadius`, `PreferencesFont`, `PreferencesMonoFont`, the `FontOption`
  type, `KanzoThemeProvider`'s `fonts` and `monoFonts` props, and the `radius`, `font`, `monoFont`,
  `fonts` and `monoFonts` fields of `useKanzoTheme()`. `KanzoTheme` takes `theme` and `appearance`
  only: its `radius`, `font`, `monoFont` and `density` props are gone. A scoped density never scaled
  anything, because a `rem` resolves against `<html>`.
- `@kanzo-tech/theme`: the `KanzoRadius`, `KanzoFont` and `KanzoMonoFont` types; the `radius`, `font`
  and `monoFont` keys of `ThemePrefs`, `DEFAULT_PREFS` and `CORE_PREFS`; `themeData.radii`,
  `.fonts` and `.monoFonts`; and the `[data-radius]`, `[data-font]` and `[data-mono-font]` rules in
  `themes.css`.

What to do: delete those controls from your settings. To change shape or typography for your product,
put the values in your theme, which you can generate at `/theme-generator`, and load the font files
your theme names yourself. A tenant `policy.theme` entry for `radius`, `font` or `monoFont` no longer
does anything, so remove it. A radius or face your users stored earlier is ignored, and they see the
theme's own.
