---
"@kanzo-tech/ai": minor
---

Ask is offered the graph's facts. What each type and field is and holds — its kind, its role, its commonest values — is read off the join graph, so asking reads nothing before the first question, and an answer's card draws by the same facts the model was told, with no read of its own. A multi-valued property is a path Ask may write (`laureate.nickname`), and the chips read the data's labels.

**Breaking:** `answerRelationsOf`, `readAnswerRelations`, `AnswerRelationsOfOptions`, `ReadAnswerRelationsOptions` and `AnswerField` are gone, and so are `types` on `useAskChat`'s and `askOffers`' options and `AskInput`, and on `AskChips`' `over`. Pass the graph alone — `useAskChat({ model, engine, graph, selection })` — and delete the read that built `types`. A field's commonest values are `FieldStat.values`.
