# field.tsx has no consumer

- **Status** superseded by `adoption-before-design` — 2026-07-26. `Field` is the most-consumed
  family in the library.
- **Decided** (was) Adopt `Field` before extending it.
- **Because** (was) no part of it had a renderer outside its own examples.
- **Reversed by** a renderer count above zero, which is what happened: the family is now imported
  across the docs site and by a double-digit number of modules inside `packages/ui/src`. Two parts
  remain without a renderer, `FieldSeparator` and `useField`.
- **Held by** `packages/ui/src/simples/field.test.tsx`

Kept because the lesson survived the example. This record is the reason
`decisions/adoption-before-design.md` exists, and it is the reason that rule's evidence is a
different one.
