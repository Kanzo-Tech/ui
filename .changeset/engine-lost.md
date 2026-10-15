---
"@kanzo-tech/mosaic": minor
---

A DuckDB worker that dies after the boot is now a state the engine handles. Every request it held
rejects with an `EngineError` whose `code` is the new `"engine/lost"` (`data.reason` is `"worker"` or
`"memory"`), later statements reject with the same instead of waiting on a worker that will not
answer, and the engine forgets itself: call `engine()` again for a new one and **attach again** — a
catalog, registered files and a mount's secrets lived in the dead worker. Before, `engine()` kept
handing out the dead engine until the page reloaded. The engine also sets DuckDB's `memory_limit` at
boot (3 GiB, or half of `navigator.deviceMemory` where the browser reports it, never under 512 MiB),
so a statement that needs more is refused by DuckDB with its own error while the worker lives.
