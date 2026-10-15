---
"@kanzo-tech/testing": minor
---

`queryableConformance(make, options?)` returns the cases an engine, or a test double of one, must pass
before a reader reads through it: columns in the shape readers use, SQL `NULL` as `null`, a refusal as
`engine/failed` without the statement's literals, a signal aborted before the call never sent, an
abort during a long statement that leaves the connection answering within 200 ms, and a dead engine
rejecting with `engine/lost`. It names no test runner; register each returned case with yours.
`{ cancels: false }` holds an engine that cannot interrupt to refusing a signal with
`engine/cannot-cancel`.
