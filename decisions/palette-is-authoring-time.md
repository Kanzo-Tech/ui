# The colour derivation is authoring-time, and structurally so

- **Status** live — 2026-07-25
- **Decided** `@kanzo-tech/palette` owns the derivation — ramps, the categorical search, the role
  table, `compile`. `@kanzo-tech/theme` keeps the stylesheets, the four non-colour axes and the
  value types, and depends on the palette as a **devDependency** only. A tenant document is derived
  once at onboarding; the runtime applies it and nothing else.
- **Because** derivation has no first-paint budget — the categorical search alone runs for a
  measurable fraction of a second to several seconds — and that was a promise anyone could break by
  accident while the search sat in a package a browser imports. Out of the dependency graph it
  *cannot* be imported rather than merely should not.
- **Reversed by** a runtime that has to derive rather than apply. None exists: a client's colour is
  a stored document, not a request parameter.
- **Held by** `packages/theme/src/boundary.test.ts`, which fails if the palette appears in
  `dependencies` or if shipped source imports it; `scripts/smoke-install.mjs`, which asserts both
  against a real installed tree and adds the one they cannot see from here — that the theme entry
  re-exports no part of the derivation

The data moved with the maths. The tables the derivation reads — ramps, seeds, schemes, palettes,
syntax roles, status ink — are inputs to the maths, and shipping them beside a stylesheet a browser
loads was half of the same defect. Had the palette kept reading them back out of the theme, the two
packages would have been a cycle, and a cycle is a structural statement that the boundary is wrong.

`CHART_SLOTS` is declared in both packages on purpose and trusted in neither: in the theme it is a
fact about the sheet, in the palette a fact about the role table, and `boundary.test.ts` holds both
against the shipped `tokens.css` so the constants answer to the artefact rather than to each other.
