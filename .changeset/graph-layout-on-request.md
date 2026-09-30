---
"@kanzo-tech/graph": minor
---

**The live layout runs only when someone asks for it.** A graph draws the corpus's positions and
nothing moves them at load. `GraphToolbar` now always shows the layout controls: play runs the force
layout from where the points are, pause leaves them where they stopped. `simulate` still starts and
stops it from the host, but you no longer need it to offer the controls — if you passed `simulate`
only so the toolbar would show them, remove it. Changing a force preference re-runs a layout only
once one has been started, and releasing pinned nodes no longer starts one. Dragging a node works
with no layout running. The play button's label for a layout at rest is now "Run the layout".
