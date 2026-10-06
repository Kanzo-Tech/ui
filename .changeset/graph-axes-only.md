---
"@kanzo-tech/graph": minor
---

**The graph's Settings are the axes alone.** Breaking. The three named looks are gone: `PRESETS`,
`presetOf` and the `LookPreset` type are no longer exported, and `useGraphPrefs()` returns
`{ look, sim }` without `preset`. A host that paired channels with a look binds them once instead:

```tsx
const { look, sim } = useGraphPrefs();
<GraphRoot fill="kind" stroke="var(--muted-foreground)" look={look} sim={sim} … />
```

`GraphLooks` now draws every axis as a row of cards, Marks and Edges with a miniature of the picture,
and offers Additive links only while edges are drawn. `GraphPlacement` draws Force, Map and Clustered
as a row of cards with a picture of each mode and one line for the checked one, with the column
selects under the row. Closes #79.
