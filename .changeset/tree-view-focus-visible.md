---
"@kanzo-tech/ui": patch
---

`TreeView` no longer paints its first row as focused when nothing is: a row's focus background shows for keyboard focus only (`:focus-visible`), not on the tab stop Ark marks at rest. A `className` that restyled the focused row through `data-focus:` should use `focus-visible:`.
