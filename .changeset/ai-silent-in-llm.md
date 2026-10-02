---
"@kanzo-tech/llm": minor
"@kanzo-tech/ai": minor
---

**`AiError` moves to `@kanzo-tech/llm`, and `createGateway` is what ends a silent model.** Every
streaming request a gateway model makes — `Assist`'s, `Chat`'s, your own `streamText` or agent —
now has its headers due within 30 s and each chunk within 30 s of the last; past that the request
is aborted and fails with an `AiError` whose `code` is `"ai/silent"` and whose `data.after` is
`30000`. A request that does not stream is not cut, and your own `abortSignal` still aborts as an
abort. `Assist` no longer runs a 30 s timer of its own, so a model that does not come from
`createGateway` is no longer cut by it.

`@kanzo-tech/ai` no longer exports `AiError`. Import it from `@kanzo-tech/llm`:

```diff
- import { AiError } from "@kanzo-tech/ai";
+ import { AiError } from "@kanzo-tech/llm";
```

If you wrapped the `fetch` you pass to `createGateway` with a deadline of your own for model
streams, remove it: two timers on one wait race to name the failure.
