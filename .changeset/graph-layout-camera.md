---
"@kanzo-tech/graph": patch
---

**A running layout no longer collapses the graph into a corner and leaves it there.** The corpus's
positions are now centred in the square cosmos.gl simulates in, so the layout contracts around the
graph's own centre; and while it runs the camera re-frames the moving points, and frames them once
more when they settle, until you zoom or pan yourself. Fit, after a layout has run, frames where the
points are. `GraphCounts spinner` also spins while a layout runs ("Laying out"). `status` stays the
data's life — a layout over a drawn graph is `idle` — so a footer that wants to say "laying out"
reads `motion === "running"` (and `progress`). Nothing to change otherwise.
