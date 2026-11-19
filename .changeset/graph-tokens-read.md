---
"@kanzo-tech/graph": minor
---

The graph section's `point-ring-hover` token is gone. Nothing ever read it, so a theme that set
`--graph-point-ring-hover` changed no pixel. The hover ring is `--primary`, as it always was. Delete
the token from your theme: `validateSection` now reports it as unknown.

`--graph-grid` now does what its documentation says: set it in a theme and the canvas's dot grid
uses it. Left unset, the grid is `--input`, as before.
