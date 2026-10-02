---
"@kanzo-tech/ui": minor
---

Appearance starts at the OS. While a person has not picked a side, `KanzoThemeProvider` and
`themeScript()` wear the side `prefers-color-scheme` reports. Once they pick, their pick is stored and
wins. A tenant's `policy.theme.appearance.default` still outranks the OS, and `pinned` still outranks
everything. The OS is never stored, so someone who never picks follows their OS. Nothing to change,
unless you relied on `light` as the starting side for everyone: then set
`policy={{ theme: { appearance: { default: "light" } } }}` on both the provider and `themeScript`.
