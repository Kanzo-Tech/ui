---
"@kanzo-tech/mosaic": minor
---

**`engine()` always settles, and a failed boot is retried.** A DuckDB worker that would not load
(a 404, a CSP refusal) used to leave `engine()` — and every chart and graph waiting on it — loading
forever. It now rejects with an `EngineError` whose `code` is `"engine/unavailable"`; a boot that
takes longer than 60 s rejects the same way, with `data.after` set to `60000`. The failure is not
remembered: the next `engine()` boots again, so a dropped download no longer needs a reload.
`engine({ signal })` ends your own wait when the signal aborts, without stopping the boot other
callers share. Key your failure screen on `error.code`; `EngineError` is exported.
