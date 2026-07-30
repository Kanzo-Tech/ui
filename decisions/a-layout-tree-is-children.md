# A layout tree is children, never an attribute

- **Status** live — 2026-07-26
- **Decided** No prop whose value is markup. A record or an array of `ReactNode`s is a layout tree
  written as an attribute. `CardRadioGroup` was deleted for it; a card radio is `RadioGroupCard`,
  and the grid it owned became `columns` on `RadioGroup`, written to a `--columns` custom property
  so a caller can override it per breakpoint — which an attribute could not.
- **Because** the caller cannot reorder the regions, wrap one, spread `className` / `data-*` /
  `aria-*` / a handler onto one, or use `asChild` on one. `CardHeader`, not
  `<Card header={…} />`.
- **Reversed by** a compound whose arrangement is genuinely closed and which no caller has ever
  needed to reorder. Three attempts have not found one. The exemption that *is* real is a
  collection a machine navigates — Ark's `createListCollection` cannot be built from children — so
  `FacetFilter`'s `items`, `Tour`'s `steps` and a faceted column's values stay props.
- **Held by** `packages/ui/src/composites/SidebarIdentity.tsx`, the doc comment on
  `SidebarIdentity`, which is the canonical statement; `packages/ui/src/index.test.ts`, the
  `CardRadioGroup` tombstone; `packages/ui/src/simples/FieldArray.tsx`, `children`, which is the
  sanctioned alternative when you want the ergonomics of a list
