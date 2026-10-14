---
"@kanzo-tech/llm": minor
"@kanzo-tech/testing": minor
---

One model double, for unit tests and end-to-end tests alike.

- `@kanzo-tech/llm/testing` exports `scriptedModel(script)`, the AI SDK's `MockLanguageModelV4` answering from a script of turns — `{ when?, once?, reply }`, a reply being `{ text, reasoning? }`, `{ object }`, `{ tool, input }`, `{ fail, after? }` or `{ hang: true }` — with an optional `pace` and a failing `load`. Pass it where a model goes. In a unit test `turns` may be a function of the call; `promptOf(call)` reads what a call was told.
- `playwright(page, { models })` and `dom(container, { models })` register a script per model id on the test hook, and `localModel(id)` from `@kanzo-tech/llm/local` answers from it in place of the model — no WebGPU, nothing downloaded — recording each prompt on `window.__KANZO_TESTING__.models.get(id).prompts`. `@kanzo-tech/testing` exports the script's types, `ModelScript`, `ModelTurn` and `ModelReply`.

If you injected a model of your own into the page for your end-to-end tests, register its script with `playwright(page, { models })` and delete the double, the branch that served it and any guard that it never ships; import the unit-test double from `@kanzo-tech/llm/testing`. `@kanzo-tech/testing` is an optional peer of `@kanzo-tech/llm`, for the script's types.
