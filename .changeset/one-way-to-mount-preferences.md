---
"@kanzo-tech/ui": major
---

`PreferencesSections` is the one way to mount a preference control. It now draws the core's
preferences as well as each installed package's section: first the theme cards (a light card and a
dark card), then density, then what packages contribute. `PreferencesPanel` with no children draws
exactly that.

Removed: `ThemePicker`, `ThemePickerProps`, `ThemePickerCopy` and `PreferencesDensity`.

What to do:

- `<ThemePicker />` becomes `<PreferencesSections namespace="theme" only={["appearance"]} />`.
  `"appearance"` and `"themeByAppearance"` both name the theme cards.
- `<PreferencesDensity />` becomes `<PreferencesSections namespace="theme" only={["density"]} />`.
- A settings page that listed the sections one by one becomes `<PreferencesSections />`.
- `ThemePicker`'s `copy` moves to `copy` on `Preferences`, `PreferencesPanel` or
  `PreferencesSections`. The type is `PreferencesCopy`, which adds `theme` (the heading over the
  cards, `"Theme"` by default). `PreferencesPanelProps` is now exported.
