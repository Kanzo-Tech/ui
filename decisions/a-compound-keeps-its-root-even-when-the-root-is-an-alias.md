# A compound keeps its root, even when the root is an alias

- **Status** live — 2026-07-31
- **Decided** `Sheet` stays, as `(props) => <Dialog {...props} />`, and `MenuSub` stays as the same
  over `Menu`. A root that renders nothing of its own is not a cut, when the family below it is
  real.
- **Because** the root is the family's **name**, not a component in its own right. Ark's dialog and
  menu roots render providers and no element, so once their dead `data-slot` came off there was
  nothing left in the body — but the thing that makes a sheet a sheet lives in `SheetContent`, and
  deleting the alias would force `<Dialog><SheetContent /></Dialog>`, which reads as a mistake and
  breaks the naming rule's own promise that a compound is greppable as one vocabulary.
- **Reversed by** the family below the root ceasing to be distinct. That is the real test, and it
  has been applied in the other direction: `ContextMenu` **was** cut, because its parts were each a
  `data-slot` rename of `Menu`'s with no appearance of their own, and the one genuine difference
  survived as `MenuContextTrigger`. `Sheet` and `MenuSub` fail that comparison — their content parts
  carry distinct geometry.
- **Held by** `packages/ui/src/simples/sheet.tsx`, `SheetContent`;
  `packages/ui/src/simples/menu.tsx`, `MenuSubContent` and `MenuSubTrigger`;
  `packages/ui/src/index.test.ts`, the `ContextMenu*` tombstones, which are the contrast

Written because a minimality sweep will find these again and the export census already lists them as
thin renames. The census is right about the shape and wrong about the conclusion, and the difference
is one question: **is the root the only thing that is thin, or is the family?** An export with no
body is evidence, not a verdict — the same trap as an export whose own root renders it.
