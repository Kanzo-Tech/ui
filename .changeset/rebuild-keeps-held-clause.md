---
"@kanzo-tech/ui": patch
---

**A chart redrawn on a resize or a theme change keeps the filter it published, as the page holds it.**
A `ChartTimeline` paused on a frame and then resized put its whole brushed range back on the page while
it still read the frame; it now keeps the frame. And a chart removed right after a brush, before a busy
page had taken the brush in, could leave that brush's filter (and its chip) on the page with nothing to
clear it; it now takes it away. Nothing to change in a host.
