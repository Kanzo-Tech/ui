---
"@kanzo-tech/ai": minor
---

**`answerRelationsOf(graph, { from, hops })` says which relations may be asked about, and
`readAnswerRelations` takes a `signal`.** `answerRelationsOf` is each type alone and through each of
its hops — what keasy's `askableRelations` and the docs' `around` hand-rolled — with `from` to keep the
hops of the types the reader is looking at and `hops: 0` to offer none. Every hop is a `SUMMARIZE`
and a count per category, and a list of fields in every prompt: over an LDBC-shaped graph at scale
factor 1 the types alone read in about 1 s, and with every hop in about 40 s.
`readAnswerRelations(coordinator, graph, relations, { signal })` rejects with the signal's reason and
cancels its queries still queued on the coordinator.

What keasy's `ask-panel.tsx` changes: delete `askableRelations`, and pass the query's signal.

```ts
queryFn: ({ signal }) => readAnswerRelations(coordinator, graph, answerRelationsOf(graph), { signal }),
```
