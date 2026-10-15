---
"@kanzo-tech/graph": patch
---

A lost WebGL context no longer ends the graph. The canvas asks the browser for the context back and, when
it returns within 5 seconds, draws the same graph again with the encoding and filters it held; the
positions on the GPU are gone with the context, so the layout starts again from the last arrangement the
graph kept or from its seeded start, and `motion` goes back to `running`. Only a context that does not
return in time fails the graph, as `graph/context-lost`.
