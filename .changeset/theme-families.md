---
"@kanzo-tech/theme": minor
"@kanzo-tech/ui": minor
---

**Themes are four families now, and the theme choice is `ThemePicker`.**

- The catalogue is `kanzo` / `kanzo-dark` (rebuilt from the kanzo.tech brand), `nord` / `nord-dark`,
  `catppuccin-latte` / `catppuccin-mocha` and `lofi` / `lofi-dark`. Every other theme is deleted —
  a stored or configured `dracula`, `bank`, `monochrome`, `catppuccin-latte-dark`… is retired (the
  provider clears it and reports it through `onThemeRetired`).
- `themeIndex` entries are `ThemeOption { value, label, dark, family }` (was `{ name, dark }`);
  `ThemeIndexEntry` is gone. `ThemeOption` gains the required `dark` and an optional `family`. New:
  `themeFamilies`, `defaultThemePair`, `CONTRAST_PAIRS`, `auditContrast`, `ThemeFamily`,
  `ContrastPair`, `ContrastFinding`.
- `KanzoThemeProvider`: `themes` defaults to `themeIndex`, so `themes={themeIndex.map(…)}` can be
  deleted. `defaultTheme` is a `{ light, dark }` pair only (a string no longer type-checks) and
  defaults to the first family. The resolved theme is always written to `data-theme`, the default
  included. `themeScript({ defaultTheme })` takes the same pair — pass it whenever you pass it to
  the provider.
- `PreferencesColor` and `PreferencesColorProps` are removed. Use `<ThemePicker />` (GitHub's
  Appearance settings: Theme mode, Day theme, Night theme); the `Preferences` panel draws it first.
  `ThemePreview` is the miniature it draws, exported for catalogues and branding pages.
- Syntax tokens: `--syntax-variable` and `--syntax-annotation` are new and `--syntax-identifier` is
  removed; a tenant theme must author all eight `--syntax-*`, plus `--input`, `--field` and
  `--faint`, which components now read with no fallback.
- Fonts: Geist and Geist Mono are the default `font` / `monoFont` (`DEFAULT_PREFS` was `"system"`),
  each falling back to the system face; `--font-mono` no longer refers to itself, so a host's
  `.cm-scroller { font-family }` override can be deleted.
