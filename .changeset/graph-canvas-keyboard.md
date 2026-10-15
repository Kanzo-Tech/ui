---
"@kanzo-tech/graph": minor
---

The graph canvas can be used without a pointer and read with a screen reader. It is one focusable
`role="application"` with a name (`translations.name`, or your own `aria-label`), a role description and a
description of what is drawn and how to operate it. The arrow keys move the focused vertex to the nearest
kept vertex that way on screen, `]` and `[` walk its neighbours in id order, Enter or Space selects it as a
click does (⌘/Ctrl adds, Alt takes), Shift and the arrows pan, `+` and `-` zoom, `F` frames and `P` pauses
or resumes the layout; the focused vertex is announced in a polite status region with its type, its
neighbours and whether the filters keep it. Under `prefers-reduced-motion: reduce` the camera no longer
glides. `GraphCanvasTranslations` gains `name`, `roledescription`, `summary` and `focused`.
