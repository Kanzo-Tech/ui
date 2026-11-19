---
"@kanzo-tech/ui": patch
"@kanzo-tech/theme": minor
---

`SectionTitle` and `EmptyTitle` now set their text in the theme's heading face (`font-heading`), as
`CardTitle`, `DialogTitle` and `AlertTitle` already did. Nothing changes for a theme that names no
heading face.

The `kanzo` and `kanzo-dark` themes name Neue Haas Grotesk Display Pro for headings, with Geist as the
fallback. The theme ships no font files: a host that has the face loads it itself, and every other host
keeps Geist.
