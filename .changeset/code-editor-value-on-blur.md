---
"@kanzo-tech/ui": patch
---

`CodeEditor` no longer loses a `value` that changes while it has focus: it is applied when the editor loses focus, rather than never. A value that changes while the editor is unfocused is applied at once, as before, and neither is reported through `onChange`.
