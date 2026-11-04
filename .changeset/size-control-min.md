---
"@kanzo-tech/theme": minor
"@kanzo-tech/ui": patch
---

`--size-control-min` is a new token: the smallest control's height, `--size-field` × 7 (1.75rem)
unless your theme authors its own. Every `sm` control — `Button`, `Input`, `Select` and the rest of
the shared scale — now reads it, so nothing changes in how they look; a theme that wants a different
floor sets one name.
