---
"@kanzo-tech/ui": patch
---

A chart no longer leaves its old marks connected to the coordinator when it is rebuilt (a resize, a theme change) or unmounted. They went on querying on every filter change for a plot nobody saw, which slowed every filter and the timeline's Play.
