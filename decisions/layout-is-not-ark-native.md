# "Idiomatic to Ark" is a category error for layout

- **Status** live — 2026-07-23
- **Decided** The layout layer takes its references from the app-shell libraries built on a
  headless core — shadcn, Mantine, Ant. Ark supplies the authoring idiom (Root, named parts,
  `ark.*`) and the Splitter machine, and nothing else. `data-slot` is not Ark's — its dist emits
  none; that convention comes from Shark and we hand-write it.
- **Because** Ark is a behaviour library and ships no layout: the one layout-adjacent primitive is
  `Splitter`, which is our `Resizable`. There is nothing upstream to match, so "make it Ark-native"
  asks for conformance to an empty set.
- **Reversed by** Ark shipping a layout family. Its component directory is the check.
- **Held by** `.planning/LAYOUT-ARK-NATIVE-REVIEW.md`, the full grounding, every claim URL- or
  file-grounded; `packages/ui/src/simples/resizable.tsx`, the one place the Splitter is used
