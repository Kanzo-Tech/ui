---
"@kanzo-tech/ai": minor
---

Everything a model offers is a proposal. `Chat`'s `suggestions` and `suggesting` are `proposals` and `proposing`, and `ChatSkeleton`'s `suggestions` is `proposals`. `suggest()` and `SuggestOptions` are removed: questions to start from are a Task's, asked with `propose(task, input, { model, count })` from `@kanzo-tech/ai/task` — each checked by the Task's oracles — or, over data, `askOffers`. `propose` answers a promise rather than a stream, and rejects with what stopped the model.
