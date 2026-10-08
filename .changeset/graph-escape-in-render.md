---
"@kanzo-tech/graph": patch
---

Escape on `GraphCanvas` no longer logs React's "Cannot update a component while rendering a different component". Dropping the tool or clearing the selection wrote the graph's store from inside a state updater, which React may run while it renders the canvas. Nothing to change on your side.
