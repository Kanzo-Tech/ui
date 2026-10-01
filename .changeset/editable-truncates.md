---
"@kanzo-tech/ui": minor
---

`EditablePreview` truncates: over an `Input` it is one ellipsised line carrying the full value as
its `title` once cut off; over a `Textarea` it wraps and grows. Consumers drop hand-written
`block truncate whitespace-nowrap` overrides. `size` is now `"sm" | "md" | "lg" | "xl"` (the icon
sizes were never meaningful for a preview), and `EditablePreviewProps` is exported.
