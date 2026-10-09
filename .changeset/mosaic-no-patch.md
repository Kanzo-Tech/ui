---
"@kanzo-tech/mosaic": patch
---

**kanzo-ui no longer patches `@uwdata/mosaic-core`, and a host no longer carries a patch.** v0.33.1
patched `Coordinator.disconnect` to cancel a client's queued queries, and asked every host to carry
the same patch. That fixed the symptom in the wrong place. The fault was the host's: it released
what the queries read (a corpus, by `DETACH`) as soon as their clients unmounted, while those
queries still waited in the queue.

**What to do:** drop `patches/@uwdata__mosaic-core@0.32.0.patch` and its `pnpm.patchedDependencies`
entry if you added them. Release anything the coordinator's clients read the way a cache collects an
entry, some time after its last reader went, not as the readers unmount. `Engine.query`'s
documentation now says so.
