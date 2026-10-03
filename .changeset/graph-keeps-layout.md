---
"@kanzo-tech/graph": minor
---

**Switching away from the graph and back keeps the layout and the camera.** When `GraphCanvas`
unmounts — a host showing a dashboard or another tab in its place — the GPU is still freed, but the
points' positions and the camera are written back into the graph's store first. The next
`GraphCanvas` under the same root draws the graph where it was, with no re-layout:

- a settled layout stays settled, and nothing runs or re-frames;
- a paused layout stays paused until Resume;
- a running layout resumes from where it was, with a reheat.

Nothing to change in your code: keep rendering `GraphCanvas` only while the graph view is shown, and
do not keep it alive off-screen to preserve the layout. What was kept is dropped when the corpus or
the `x`/`y` binding changes, and the next canvas lays that graph out from the start, as before.
`motion` keeps its value while no canvas is attached, so a status read with the canvas gone says what
the layout will do when it comes back.
