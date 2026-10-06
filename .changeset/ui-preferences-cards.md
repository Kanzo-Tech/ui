---
"@kanzo-tech/ui": minor
---

**A preference is a part: `<Pref name>`, `usePref` and `SectionProvider`.** Breaking.

- `PreferencesSections` loses `only` and `specimens`. Write the parts instead:
  `<PreferencesSections namespace="theme" only={["density"]} />` becomes `<Pref name="theme.density" />`,
  and `specimens={{ "graph.look": … }}` moves to the section's owner,
  `<SectionProvider namespace="graph" specimens={{ look: … }}>`.
- `usePref(name)` answers `{ value, setValue, options, offered, shown }` for a control of your own.
- `SectionProvider` lets a section's owner answer the lists its choices name and the pictures its
  options wear, for the subtree beneath it. `KanzoThemeProvider` is the core's; `useKanzoTheme()` no
  longer returns `sources`.
- A choice whose options come from a source is drawn as a `Select`; every other choice is a row of
  radio cards, a specimen above the name.
- Names are checked once you augment `Register`:
  `declare module "@kanzo-tech/ui" { interface Register { sections: typeof SECTIONS } }`.
- `KanzoThemeProvider`'s `sections` takes a `readonly` array.
