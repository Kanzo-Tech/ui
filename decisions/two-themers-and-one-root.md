# Two themers, and only one of them owns the root

- **Status** live — 2026-08-04
- **Decided** `KanzoThemeProvider` writes the axes to `document.documentElement` and is the app's
  themer. `KanzoTheme` writes the same attributes to a `<div>` and is for previews. Both ship; they
  are not interchangeable and the difference is asserted rather than described.
- **Because** a scoped theme can paint a palette now that a document compiles per attribute, and a
  gallery of five palettes on one page is a real screen that the root-only provider cannot express.
- **Reversed by** a scope that could theme Ark's portalled overlays. It cannot: they mount to
  `document.body`, outside any wrapper, which is why the root provider stays the app's.
- **Held by** `packages/ui/src/index.test.ts`, "exposes two themers, and they are not
  interchangeable"; `packages/ui/src/theme/KanzoTheme.tsx`

Supersedes [[one-theme-provider]], whose portal argument survives intact — it is what keeps this
one bounded to previews. The half that fell was about colour, not about portals: when a document
was a whole stylesheet the server chose, a wrapper had no block to select and the component could
only move the non-colour axes. `compile(doc, { scope })` emits a two-member selector list whose
unqualified member exists precisely so it can match an element that is not `<html>`.

**Density is the second reason the root keeps the app.** It sets the root font-size the whole `rem`
scale resolves against, so on a wrapper it was broken outright rather than merely partial. A scope
that is only ever a preview never has to answer for that.
