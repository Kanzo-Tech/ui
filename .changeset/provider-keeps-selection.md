---
"@kanzo-tech/ui": patch
"@kanzo-tech/mosaic": patch
---

`MosaicProvider` keeps the page's selection when `joins` becomes a new graph, so filters already
set and the charts attached to them are no longer dropped; the selection's resolver reads the new
graph from then on. The provider also sets vgplot's active coordinator in a layout effect rather
than during render, so StrictMode and concurrent rendering no longer run it twice. `JoinResolver.joins`
is now assignable.
