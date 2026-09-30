---
"@kanzo-tech/graph": patch
---

**A graph no longer fails with "signal is aborted without reason".** In development React mounts,
unmounts and mounts every component again; the unmount cancelled the corpus read, the cancellation
was reported as a failure, and the canvas showed "the graph could not be drawn". A cancelled read is
no longer a failure, and a graph that is mounted again reads its corpus again. Nothing to change in
your code.
