---
"@kanzo-tech/graph": patch
---

An unbound graph — `x` and `y` left to the layout — draws again. Under cosmos.gl 3.4 every such graph
opened blank, whatever its size: the simulation was turned on before the render that uploads
the positions, cosmos.gl dropped that upload, and each layout tick threw `Cannot destructure property
'device' of 'texture'` from the camera's `fitView`. The layout now starts after that render, at any size.

The camera reads positions back only once the device is up and they have been rendered, and if a read
fails anyway the graph reports it instead of throwing every frame: `onFailure` receives a `GraphError`
with the new code `graph/no-positions` (the read's error as its `cause`) and the status is `failed`. A
host that switches over `GraphError["code"]` has one more case to show.
