---
"@kanzo-tech/ui": minor
"@kanzo-tech/ai": minor
---

**The packages ship Tailwind v4 source, and your build compiles the page once.**

`@kanzo-tech/ui/styles.css` and `@kanzo-tech/ai/styles.css` are gone. Replace every import of them,
and of `@kanzo-tech/theme/tokens.css`, with the two entries in your Tailwind stylesheet:

```css
@import "tailwindcss";
@import "@kanzo-tech/ui/tailwind.css";
@import "@kanzo-tech/ai/tailwind.css"; /* only with @kanzo-tech/ai */
```

Then delete what you had to restate: `@custom-variant dark (…)`, and any `@source` pointing at
`streamdown/dist` — the entries declare both. `tailwindcss@^4` is now a required peer of
`@kanzo-tech/ui`.

Three compiled sheets on one page could not be ordered: `@kanzo-tech/ai`'s `.hidden` came after
`@kanzo-tech/ui`'s `md:block`, so the desktop `Sidebar` was `display: none` at every width. One build
has one preflight and one variant order, and your own utilities resolve against the same tokens.
