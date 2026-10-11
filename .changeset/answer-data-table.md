---
"@kanzo-tech/ai": patch
"@kanzo-tech/testing": minor
---

**An answer's rows are on the page, as a table.** `AnswerCard` now holds the rows the answer was read
from — what the engine returned under the page's filter when the call ran, capped as the model's
are — as a visually hidden table captioned *The rows the answer was read from* (*…, the first, cut
short by the cap* when it was). A chart's long description is its data, after the W3C WAI Images
Tutorial's *Complex Images*: whoever cannot see the chart reads the table. Two new translations,
`data` and `truncated`, word the caption.

`AnswerHarness.rows()` reads that table, each row by its column's name: assert an answer's figures
there — the engine's — rather than in the chart, which draws them, or in the model's reply, which on a
replayed take is a recording.

The `./data` size budget is raised as a decision, from 8.5 kB to 8.75 kB, for the table (8.55 kB
measured).
