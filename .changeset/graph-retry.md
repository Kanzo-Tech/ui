---
"@kanzo-tech/graph": minor
---

A failed read can be tried again without remounting the graph: `retry()` on the api runs the load again
from the read that failed, and asks the filter again. Every read of a load now stops with it, taken off
the coordinator's queue when the corpus changes, the root unmounts or a retry starts. A filter whose
survivors cannot be read now puts the graph in `failed` and reports the error, where it used to report
it while the picture and the filter chip went on claiming the filter was in force.
