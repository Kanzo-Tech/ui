---
"@kanzo-tech/ai": minor
"@kanzo-tech/llm": minor
---

Ask runs in the chat as a Task. `useAskChat({ model, engine, graph, types, selection })` replaces `useAgentChat(dataAgent(…))`: each question is one run of `ask`, its answer is the same `answer` part `AnswerCard` draws, and the sentence after it is written from the rows rather than by the model. When two relations answer a question equally the reply asks which, numbered, and the reader's next message picks one. `types` is each type alone — `readAnswerRelations(coordinator, graph, answerRelationsOf(graph, { hops: 0 }))` — where `relations` offered every hop.

`askOffers({ model, graph, types, selection })` replaces `dataSuggestions`: the questions to start from are Ask's own proposals, each checked before it is offered, so every pill is one the chat answers. It answers a promise of `{ text, spec }`, not a stream.

Removed: `dataAgent`, `dataInstructions`, `dataSuggestions`, `DataAgentOptions`, `DataSuggestionsOptions` and `DataTools`, and with them the `context: { tokens, reserve }` option — a question is asked over the types it names, so there is no budget to fit. `AiError`'s `ai/context` code and its `tokens` and `budget` data are gone from `@kanzo-tech/llm`. `readAnswer` is the read an answer is drawn from, for a host with its own transport; `askTransport` is the transport alone.
