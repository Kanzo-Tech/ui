---
"@kanzo-tech/ui": minor
---

**`FieldRequiredIndicator` takes a `fallback`, and an optional field says so.** On a field that is not
required it renders the `fallback` instead of the asterisk, styled as muted text and read as part of
the label. Replace any "(optional)" written into a label string with
`<FieldRequiredIndicator fallback="(optional)" />` — in whatever words your product uses.
