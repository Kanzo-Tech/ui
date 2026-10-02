---
"@kanzo-tech/graph": patch
---

**A graph opens framed even when its canvas settles its size after mount.** In a split panel or
beside a dock the canvas width changes after the first frame, and the view opened zoomed into one
corner until you pressed Fit. The camera now frames the corpus again when the GPU device comes up
and on every resize of the canvas, until you zoom or pan yourself; Fit hands it back. Nothing to
change in your code.
