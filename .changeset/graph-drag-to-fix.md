---
"@kanzo-tech/graph": minor
---

**Dragging a node pins it only while a layout runs, and releasing the pins visibly re-flows the
graph.** Before, a drag pinned the node even with no layout running, where a pin holds against
nothing, and "Release N pinned nodes" cleared the pins without moving anything. Now a drag with the
layout settled just moves the node; a drag while the layout runs or is paused pins it; and
`unpin()` — the toolbar's release button — reheats the layout: a running one keeps running, a
settled one cools back to settled on its own, and a paused one runs briefly and pauses again.
Nothing to change in your code.
