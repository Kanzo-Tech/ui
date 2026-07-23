---
"@kanzo-tech/ui": minor
---

Rename three components whose names were too narrow.

- `GhostEditor` → `CompletionField` — it is a textarea with streaming inline completion, not a
  code editor; the new name sits with the field vocabulary and says what it does. Still on the
  `/editor` subpath (CodeMirror is an optional peer).
- `MadeWithKanzo` → `MadeWith` — the brand was already a `by` prop defaulting to "Kanzo"; only
  the name hard-coded it. Now it does not.

In the docs, the Sidebar nav composites are titled by function — SidebarNav is "Menu",
SectionNav is "Sections".
