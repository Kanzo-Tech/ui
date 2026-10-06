---
"@kanzo-tech/theme": minor
---

**`SectionManifest` has no `version`.** Breaking. Delete the `version` field from every section you
declare; a stored value the manifest no longer offers already falls back to its default, so there is
nothing to migrate.
