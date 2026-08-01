# A machine with a switch is a variant; a new content contract is a composite

- **Status** live — 2026-07-23
- **Decided** The test for "should this be a new component?", in one line: **a machine with a
  switch → a variant or a mode; a new content contract assembled on a primitive → a PascalCase
  composite.**
- **Because** every taxonomy argument in this library reduces to it. `AlertDialog` is `Dialog` with
  `role="alertdialog"` plus a convention layer — one machine, one switch — the same shape as a
  context menu against `Menu`, which is why neither is a separate primitive. `Preferences` spans
  structure, a content contract and behaviour over the dialog, field and radio-group parts, so it is
  a composite and not `Dialog variant="preferences"`.
- **Reversed by** nothing found in five rounds of applying it. Where it and the single-axis rule
  disagree, they have always disagreed about a component that should not have existed.
- **Held by** `packages/ui/src/simples/alert-dialog.tsx`, which is literally `Dialog` with a role;
  `packages/ui/src/index.test.ts`, the `ContextMenu*` tombstones

Ark models `alertdialog` as a role and not as a machine. Radix separates them because there they
genuinely are two primitives; copying that split here would fork us from our own behaviour library
for no gain.
