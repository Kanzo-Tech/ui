---
"@kanzo-tech/graph": minor
---

**A drag moves a node and holds nothing: pinning is gone.** Dropping a node no longer pins it while a
layout runs. A running layout pulls it back among its neighbours, and a settled or paused one leaves
it where it was dropped. To keep an arrangement, bind `x` and `y` to columns instead.

- `GraphState.pinned` is removed. Delete any `useGraphState((s) => s.pinned…)` read.
- `GraphCommands.unpin()` is removed. Delete the call: there is nothing to release.
- `GraphToolbar` no longer shows the "Release N pinned nodes" button.
- `restart()` runs the layout from full heat. It used to release pins first.
