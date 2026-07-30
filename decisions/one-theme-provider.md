# One theme provider, writing to `<html>`

- **Status** live — 2026-07-24
- **Decided** `KanzoThemeProvider` is the only provider, and it writes the axes as `data-*`
  attributes on `document.documentElement`. `KanzoTheme`, which wrote them to a wrapper `<div>`,
  is deleted with no alias.
- **Because** Ark's overlays — Dialog, Popover, Menu, Select, Tooltip, Toast, HoverCard, Command —
  portal into `document.body`, outside any wrapper, so a wrapper cannot theme them; and density
  sets the root font-size that the whole `rem` scale resolves against, so on a wrapper it was
  broken outright.
- **Reversed by** nothing available: the constraint is Ark's portal target, not a preference. Two
  providers would also reintroduce the defect that made this a decision — the deleted one was the
  *documented* entry point while a repo-wide grep found zero usages of it.
- **Held by** `packages/ui/src/index.test.ts`, "exposes exactly one themer";
  `packages/theme/tokens.css`, the header note; `packages/ui/src/theme/KanzoThemeProvider.tsx`
