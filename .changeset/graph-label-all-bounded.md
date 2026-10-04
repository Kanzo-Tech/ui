---
"@kanzo-tech/graph": patch
---

**The `All` label level is every point in view, not every point.** It adds every point of cosmos.gl's
sample of the view — one per 100 px square — to Top's 150, so it never labels more than the screen
holds, whatever the graph's size. It used to sort, mount, track and read the title of every vertex,
which stalled a page drawing 327k of them. Titles are read for the labelled points only. Nothing to
change in a host: `labels: "all"` keeps its name and is now safe at any size.
