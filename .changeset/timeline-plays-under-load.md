---
"@kanzo-tech/ui": patch
---

**`ChartTimeline` plays to the end of a range brushed a moment before Play.** On a busy page, Play
pressed right after a brush could show one bar and stop, or play on from an old frame, because the
window's snap to the bars' edges reached the timeline after the press and was taken for a new range.
Play now reads the range when it is pressed. Nothing to change in a host.
