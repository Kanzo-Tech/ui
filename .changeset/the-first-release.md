---
"@kanzo-tech/palette": minor
"@kanzo-tech/theme": minor
"@kanzo-tech/ui": minor
---

**The first release.** Three packages, arriving together. Nothing before this was published, so
this note describes what the packages *are* rather than how they got here.

### `@kanzo-tech/ui`

Ark UI for behaviour, `tailwind-variants` over design tokens for appearance, and a flat export
surface: `DialogTrigger` and `DialogContent`, never `Dialog.Trigger`. Three layers — single-purpose
simples, domain-free composites, and the Shell and Section layout regions — all exported flat, so a
component moving between them is not a breaking change.

Import the compiled stylesheet once: `import "@kanzo-tech/ui/styles.css"`.

**The export surface tracks Shark UI's registry.** If Shark's `registry/react/components/<file>.tsx`
exports a name, this package exports it — every part, including the ones a root renders for you, and
the recipes Shark makes public (`alertVariants`, `badgeVariants`, `menuContentVariants`,
`toggleVariants`). A part that a root already places is exported so you can build a root of your
own, not so you can add a second one inside ours: `Progress` places its own track, `ScrollArea` its
own scrollbars, and putting another inside them renders another.

**Every part carries a `data-slot`, and you style against it.** That is the escape hatch you get
instead of guessing class names, and our own recipes select on it. Two things follow for you:

- **You cannot erase one.** Each part writes its slot after your props, so a stray `data-slot` in a
  spread cannot silently delete the styling the component depends on.
- **`slot` renames one.** Pass `slot="…"` to any part to change the value a recipe selects — the
  declared way to make one instance answer to different styling. Under `asChild` the child's own
  slot wins, so name the element you actually render.

`slot` is otherwise a real DOM attribute used for shadow-DOM slotting, which these components now
consume rather than forward.

### `@kanzo-tech/theme`

The stylesheets, the axis table, and the value types. No React, no components, no colour maths.

Four axes are not colour at all — radius, font, mono font, density. The fifth, `identity`, is the
one whose values a *tenant* authors: which brand of the document they published applies. It is the
first axis whose selectors come out of `compile()` rather than the generator, which is what `AXES`
records as `source`.

### `@kanzo-tech/palette`

The colour derivation: ramps, the categorical search, the role table, `compile`. A tenant's palette
is a document derived once at onboarding, and everything downstream — the primary colour, the
charts, the dashboards — comes from that one artefact.

### The four one-way doors

These are the decisions a consumer cannot work around, so they are the ones worth stating up front.

- **Theme attributes go on `<html>`.** `KanzoThemeProvider` writes them there because Ark's
  overlays portal to `document.body`, outside any wrapper, and density sets the root font-size the
  whole `rem` scale resolves against. A wrapper element cannot theme this library.
- **`@kanzo-tech/palette` is authoring-time.** It is a devDependency of `@kanzo-tech/theme`, not a
  runtime dependency: the categorical search is measured in seconds and has no first-paint budget.
  The runtime applies a stored document and derives nothing.
- **Optional peers live on subpaths.** `@kanzo-tech/ui/editor` needs `@codemirror/*`, `/table` needs
  `@tanstack/react-table`, `/analytics` needs the DuckDB and Mosaic stack. The root barrel imports
  none of them, so `import { Button }` works without any of them installed.
- **Dark mode belongs to the host.** Pass your theme manager in as `appearance={{ resolvedTheme,
  setTheme }}`, or omit it and the provider toggles `.dark` itself. For SSR, `themeScript()` in
  `<head>` plus `cookieStorageAdapter()`.

### The user never authors a colour value

They choose among colours someone already validated, and there are three such choices, coarsest
first: `palette` (a whole document a tenant published, surfaces included), `identity` (its brand
only, with the neutral and the statuses shared — which is what keeps several product lines one
product), and `appearance` (which of the document's two blocks applies).

What is gone is authoring a *part* of a palette at runtime: no `base`, no `accent`, no chart-scheme
attribute, and `data-palette` stays forbidden. Each of those expressed part of a palette; a document
expresses all of it before a byte is sent. A palette therefore writes no attribute at all — it is
served — while `data-identity` selects among blocks that document already contains.
