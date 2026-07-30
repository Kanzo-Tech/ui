# A region places its children and carries no aesthetic

- **Status** live — 2026-07-22
- **Decided** The shell regions declare placement, the separating border, and what shrinks and what
  scrolls. No height, no surface, no typography, no font size, no role. There is no bar component.
- **Because** `Toolbar`, `StatusBar` and `TopBarUtility` were three copies of one strip; merging
  them into a generic `ShellBar` kept the fixed height, the card surface, the muted ink and the
  eleven-pixel font — the IDE aesthetic of the component the owner had explicitly rejected.
  Generalising an implementation while preserving a rejected appearance is not generalising.
- **Reversed by** a caller who cannot express the strip they want by putting content in a region.
  Three attempts produced no such caller; the dense IDE strip now lives in the workspace showcase,
  where anyone who wants that look copies it.
- **Held by** `packages/ui/src/layouts/shell.tsx`, the region set;
  `packages/ui/src/layouts/shell.test.tsx`, "Not `role=\"toolbar\"`"; `DESIGN.md`, the layout layer

The role half is a rule of its own: a bottom region is often `contentinfo`, a top one often
`banner`, a strip is neither, and a shell may have several. The call site passes the landmark. A
composite role claimed without its keyboard contract — `role="toolbar"` over independently tabbable
items, with no roving focus — is worse than no role at all.
