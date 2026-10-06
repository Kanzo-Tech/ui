---
"@kanzo-tech/theme": minor
---

**Sections: no `version`, a `when`, and lists named by their section.** Breaking.

- `SectionManifest` has no `version`. Delete it from every section you declare; a stored value the
  manifest no longer offers already falls back to its default, so there is nothing to migrate.
- A preference may declare `when: { pref, eq }` or `{ pref, neq }` — offered only while a sibling
  resolves to that value. `prefShown(decl, values)` reads it.
- `PrefSource` is any name, scoped to the section that declares it: `{ from: "columns" }` is answered
  by the section's owner. The core's `"themes"` is unchanged.
