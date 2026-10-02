---
"@kanzo-tech/ui": minor
---

**`Findings`: what a check found, behind one badge.** A `Badge` that tallies the findings and opens a
popover listing them worst first, grouped by variant, each with a way to its place.

- `FindingsRoot` takes `findings` — anything with an `id` and a `variant` (`"destructive" |
  "warning" | "info"`, `Diagnostic`'s) — and `onSelect`. It is Ark's `Popover`, so `open`,
  `defaultOpen` and `onOpenChange` work as they do there.
- `FindingsTrigger` is painted by the worst variant present; its child is the tally in your words,
  as a function of `{ destructive, warning, info, total }`. With nothing found it is a static
  `success` badge, not a button.
- `FindingsContent` (`title`, `description`), `FindingsGroup` (`variant`, `title`, and a function from
  a finding to its row), `FindingsGoTo` (closes the popover, then calls `onSelect` with the row's
  finding).
- `useFindings` and `useFinding` reach the same state from a part of your own.

No part authors a word: every label is a prop or a child of the part that draws it.
