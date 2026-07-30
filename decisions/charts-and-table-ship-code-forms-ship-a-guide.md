# Charts and the data table ship code; forms ship a guide

- **Status** live — 2026-07-25
- **Decided** Mosaic and TanStack Table get a thin layer of our own — `/analytics`, `/table`.
  Validation gets a documented pattern and no layer.
- **Because** the two engines have one obvious binding each and the whole cost is wiring it
  correctly once; validation has no obvious binding, because our own consumers validate in ways
  with almost nothing in common, so any model rich enough for both would be shaped by whichever
  shouted loudest.
- **Reversed by** a second validation consumer that agrees with the first about keys, severity and
  cardinality. Two have not.
- **Held by** `.planning/FORMS-DECISION.md`, the full reasoning; `packages/ui/src/table.ts` and
  `packages/ui/src/analytics.ts`, the two layers that were built

The corollary that shaped both layers: a mark cannot be an Ark part, because vgplot replaces the
host's children wholesale and there is no DOM for a part to own. That is why `/analytics` is
descriptors and a root, not a compound.
