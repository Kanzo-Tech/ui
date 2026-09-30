---
"@kanzo-tech/ui": patch
---

**A `<kbd>` inside `InputGroupText` is rounded again.** Its corner read `--radius`, which the theme
no longer declares, and came out square; it now follows the field radius like the group around it.
