---
"@kanzo-tech/ui": minor
---

**`PreferencesSections` draws a picture for a contributed choice.** Pass `specimens`, keyed
`namespace.preference`, and that choice's options become cards with the picture over the name — the
way the core draws density:

```tsx
<PreferencesSections
  specimens={{ "playground.layout": (option) => <LayoutGlyph layout={option.value} /> }}
/>
```

A choice without one is still a list.
