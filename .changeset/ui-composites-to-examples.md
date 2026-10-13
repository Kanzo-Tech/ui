---
"@kanzo-tech/ui": minor
---

`Preferences`, `ThemeNotice` and `FloatingPanel` leave `@kanzo-tech/ui`; each is an example in the docs to copy. **Breaking:** replace `<Preferences hotkey="p" triggerClassName="…" />` with `<PreferencesRoot hotkey="p"><PreferencesTrigger className="…" /><PreferencesPanel /></PreferencesRoot>` — `PreferencesProps` is gone with it. `ThemeNotice`, `ThemeNoticeProps` and `ThemeRetiredCopy` are gone: read `useKanzoTheme().retiredTheme` and toast it once, as `/docs/hooks/use-kanzo-theme#the-retired-theme-as-a-toast` does. `FloatingPanel`, `FloatingPanelResizeHandle` and their props are gone: copy `/docs/layout/floating-panel`'s example.
