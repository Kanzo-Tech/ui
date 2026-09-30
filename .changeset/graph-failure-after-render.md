---
"@kanzo-tech/graph": patch
---

**A failure found while `GraphRoot` mounts no longer updates your component during render.** A corpus
with no drawable type, or a scan fossil refused, was reported to `onFailure` while React was still
rendering the root, so an `onFailure={setError}` logged "Cannot update a component while rendering a
different component". It is now reported once the root has mounted. Nothing to change on your side.
