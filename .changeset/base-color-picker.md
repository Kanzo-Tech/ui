---
"@kanzo-tech/ui": minor
"@kanzo-tech/theme": minor
---

Base colour is now a full `ColorPicker` (shared `ColorField` with accent): the 9 curated neutral
scales are preset swatches, and any other colour generates a tinted neutral ramp via `color-mix`
(`--color-custom-*` + a generated `data-base="custom"` scale). Applied live by the provider
(`baseTint`), reproduced by the SSR `themeScript`, and included self-contained in "Copy theme CSS".
