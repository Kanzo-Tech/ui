---
"@kanzo-tech/mosaic": patch
---

**A Mosaic client that disconnects takes its queued queries with it.** kanzo-ui now carries a patch to
`@uwdata/mosaic-core` 0.32.0's `Coordinator`: `disconnect(client)` cancels the queries the client had
queued, and their data or error no longer reaches the client or the log. Without it, a page that tears
down while a filter changes ran those queries after the host had released what they read, and logged
`Catalog Error … does not exist`.

**What to do:** `@uwdata/mosaic-core` is a peer, so the patch has to be carried by your install too.
Copy `patches/@uwdata__mosaic-core@0.32.0.patch` from this repository and add it under
`pnpm.patchedDependencies` (or your package manager's equivalent).
