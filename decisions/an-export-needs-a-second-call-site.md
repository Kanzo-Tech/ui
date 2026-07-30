# An export needs a second call site, and one example is not it

- **Status** live — 2026-07-26
- **Decided** An export whose only consumer is one `docs/examples/<slug>/` directory has not met
  admission rule 2. Delete the export. Keep the symbol when its own root renders it.
- **Because** an example is the page proving the part exists, not a consumer choosing it. There is
  no compatibility question — nothing is published.
- **Reversed by** a second independent call site.
- **Held by** `packages/ui/src/index.test.ts`, the pinned set and the tombstones

The care this needs is the whole finding: a naive sweep breaks components, because an export can
have no *export* consumer purely because its own root renders it — `SheetOverlay`,
`SheetPositioner`, `TourPositioner`, `TourOverlay`, `TourSpotlight`, `ClipboardIndicator`. And a
recipe can read as "used only by its own file" while another module imports it in type position:
`statusVariants` is imported by `avatar.tsx` for `VariantProps<typeof statusVariants>`, which still
requires the value to be exported.

`ProgressTrack` was held up as the ideal version of this shape — the part a consumer never places.
It was not. `Progress` renders the track unconditionally, so a consumer who followed the export got
two troughs: the export was the defect, not the model case. Confirmed independently twice, and the
export has since been removed while the symbol stayed, which is exactly the move this record
prescribes.
