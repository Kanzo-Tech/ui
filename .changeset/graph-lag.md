---
"@kanzo-tech/graph": patch
---

**The graph stays responsive on large corpora.** Points and colours no longer animate into place
when tiles arrive: they appear where they belong, so a pan no longer keeps the canvas redrawing for
the better part of a second after it stops. Selecting, focusing and pinning a node, and hovering one,
no longer redo work proportional to the whole graph. Nothing to change in your code.
