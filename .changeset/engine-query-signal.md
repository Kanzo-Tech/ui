---
"@kanzo-tech/mosaic": minor
---

**`engine().query(sql, { signal })` requires the signal.** It is the shape fossil's `Engine` now
requires, so the engine you chart through stays the one a corpus opens into. Where you called
`query(sql)` with no options, pass one: `query(sql, { signal: controller.signal })` — an abort
interrupts the running statement and rejects with `signal.reason`.
