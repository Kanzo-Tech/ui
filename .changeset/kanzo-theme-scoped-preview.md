---
"@kanzo-tech/ui": minor
---

**`KanzoTheme` comes back, because a scope can finally paint a palette.**

It was deleted once, and the reason still half applies: it sets the theme attributes on a wrapper
`<div>`, so it cannot reach Ark's portalled overlays, and beside the real provider it gave callers
no way to tell which was which — a repo-wide grep found zero JSX usages.

What changed is the other half. While a document was a whole stylesheet the server picked, a scope
had no palette block to select and its only real power was over the non-colour axes. With
`compile(doc, { scope })` there is one block per document and all of them ship, so five palettes on
one page is a thing that can exist.

```tsx
{palettes.map((p) => (
  <KanzoTheme key={p.id} palette={p.id}><PaletteCard /></KanzoTheme>
))}
```

Verified live, reading computed values off the DOM rather than from a screenshot: a scoped div
resolves `--syntax-keyword` to `#ba3989` and `--brand-9` to `#e562af` while `<html>` stays on
`#8200db` / `#737373`, and the subtree inherits the scope.

- **No `appearance` prop, deliberately.** Dark is a class on an ancestor, so adding `.dark` to a
  wrapper inside a light page would work while removing it inside a *dark* page would not — the
  tokens are already inherited and a class cannot un-inherit them. Forcing light needs a `.light`
  counterpart in every compiled document, which is a change to `compile()`. A prop that worked in
  one direction only, with the failing direction looking exactly like the working one, is not
  offered.
- **The portal limit is a test**, not a warning to remember: `KanzoTheme.test.tsx` asserts that a
  portalled element has no `[data-palette]` ancestor.
- It reports what it paints, so `useThemeTick` and every chart inside re-resolve against the scope
  instead of keeping the page's brand in their buffers.

**The docs are the consumer, and they got smaller.** The site read a cookie in its root layout,
inlined the one document it named, and served the rest from a `/palette/[id]` route — which made
every page under it dynamic. All five documents are 7.6 kB gzipped, so they are inlined once, the
cookie and the route are deleted, and `next build` now reports `/docs/[[...slug]]` as `●`
prerendered where it reported `ƒ`.
