---
"@kanzo-tech/ai": patch
---

**`dataAgent` reads with the page's engine, and says which of the page's clauses it left out.**
The agent takes `engine` (the page's `Engine`, or anything with its `query`) in place of
`coordinator`: write `dataAgent({ model, engine, graph, relations, selection })`. It reads outside
the coordinator's queue, so a question asked before switching tabs answers in the hidden tab, and
*Stop* ends the wait at once with the chat's signal.

`AnswerOutput` gains `skipped`, each a `SkippedClause` `{ clause, missing }`: the page's clauses the
answer's relation could not answer, with the columns it lacks. The model is told them, and
`AnswerCard` draws one line under the tile — *Read under the page's filter: … Not applied, as this
relation lacks the fields they filter: …* — with the new `under` and `skipped` translations.
