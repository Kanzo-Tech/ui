---
"@kanzo-tech/ui": patch
---

A vertical `Slider` now takes the height you give it (`className="h-48"`). Before, its own `h-full` overrode any height class, so it grew to fill whatever contained it.

An ordered preference with more than three stops, such as the graph's Labels, now labels only its two ends, shows the chosen stop's name beside the title, and announces that name on the thumb. Before, the stop names ran into each other at a panel's width, and a screen reader heard an index.
