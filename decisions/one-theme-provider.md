# One theme provider, writing to `<html>`

- **Status** superseded by `two-themers-and-one-root` — 2026-08-04
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
- **Held by** `packages/ui/src/index.test.ts`, "exposes two themers, and they are not interchangeable";
  `packages/ui/src/theme/KanzoThemeProvider.tsx`

**What reversed it, and what did not.** The portal argument above is still true and still the
reason a scope is not the chrome of an app — `KanzoTheme.test.tsx` asserts it directly rather than
leaving it as a warning. What stopped being true is the other half: a scope could not paint a
different *palette* while a document was one stylesheet the server picked, so there was no block
for an attribute to select and the component's only real power was over the non-colour axes.
`compile(doc, { scope })` emits one document per attribute now. A palette gallery — five documents
on one page — became a thing that can exist, and that is what the successor records.
