---
"@kanzo-tech/mosaic": minor
---

`Engine.query` now stops the statement when its signal aborts, not only the wait for it. *Stop* on a
read that had a long `SUMMARIZE` or aggregate running used to reject at once and leave the statement
running, so every later read waited for the seconds it had left; now DuckDB interrupts it, the call
rejects with `signal.reason`, and the next statement on the connection answers at once (measured: a
statement that would run 27 s, aborted at 100 ms, then the next trivial statement in 47 to 166 ms). A
statement still waiting its turn when the signal aborts is never sent. An abort that arrives after the
statement finished is ignored and the call resolves. Charts and the graph read through the coordinator, which now runs its statements through the same
path, in turn with `Engine.query`; they carry no signal, so a chart's own statement is never
interrupted.
