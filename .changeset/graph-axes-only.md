---
"@kanzo-tech/graph": minor
---

**The graph's settings are its section, drawn by `@kanzo-tech/ui`.** Breaking.

- `GraphLooks` and `GraphPlacement` are gone, with their props types. The whole settings tab is now
  one line under the root, and the root supplies the corpus's columns and the cards' pictures itself:

  ```tsx
  const { look, sim, placement } = useGraphPrefs();
  <GraphRoot look={look} sim={sim} {...placement} fill="kind" …>
    <PreferencesSections namespace="graph" />
  </GraphRoot>
  ```

- Placement is a preference now: `GRAPH_SECTION` declares `placement` (Force · Map · Clustered),
  `x-by`, `y-by` and `cluster-by`. Drop the `useState` that held `x`/`y`/`cluster` and spread
  `useGraphPrefs().placement` on the root instead. A column a corpus does not carry is read as
  unbound, so the layout runs.
- The three named looks are gone: `PRESETS`, `presetOf` and `LookPreset` are no longer exported, and
  `useGraphPrefs()` returns `{ look, sim, placement }`. A host that paired channels with a look binds
  them once on the root.
- New: `placementFrom` and the `Placement` type, beside `lookFrom` and `simFrom`.
- Additive links is offered only while edges are drawn, and Cluster pull only under Clustered.

Closes #79.
