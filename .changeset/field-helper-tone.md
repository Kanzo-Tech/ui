---
"@kanzo-tech/ui": minor
---

**`FieldHelper` takes a `tone`.** `<FieldHelper tone="warning">` and `tone="info"` colour the helper
line for a message the value survives — a warning next to a field that is still valid — where it used
to be muted only. The default is unchanged. It stays the one message wired into the control's
`aria-describedby`; keep `FieldError` for what blocks, and put a second line in `FieldDescription`.
