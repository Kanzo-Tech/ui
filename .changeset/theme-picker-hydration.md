---
"@kanzo-tech/ui": patch
---

`ThemePicker` no longer fails hydration when the user's stored theme differs from the default. Under
SSR the server cannot read the user's storage, so the picker was drawn with the default side Active
and hydrated against the stored one — a hydration error in development, and a regenerated tree. The
uncontrolled `KanzoThemeProvider` now reads its `storage` right after the first render, before the
first paint, so the server and the hydrating client render the same markup. Nothing to change: keep
`themeScript()` in the document, which still paints `<html>` before anything is drawn.
