---
"@kanzo-tech/ai": minor
---

`@kanzo-tech/ai/data` exports `ask`, Ask as a Task: run with `runTask(ask, { question, graph, types, under })`, the model fills a spec — what is counted, the fields it is shown by, what it is narrowed to — and the relation is computed by `@kanzo-tech/mosaic`'s `resolveRelation`. A question no relation reaches is sent back to the model; one two relations answer equally is a `Decision` for the reader. `askAnswer` makes the answer `AnswerCard` draws. `dataAgent` is unchanged.
