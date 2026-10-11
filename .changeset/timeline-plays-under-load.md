---
"@kanzo-tech/ui": patch
---

**`ChartTimeline` has the range you brushed the moment the drag ends, and plays it to the end.** On a
busy page the window's snap to the bars' edges reached the timeline late: Play right after a brush
could show one bar and stop, or play on from an old frame, and Play, the window's readout and its
colour could trail the drag. The timeline now reads the range when a drag ends and when Play is
pressed. Nothing to change in a host.
