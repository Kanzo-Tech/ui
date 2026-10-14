---
"@kanzo-tech/llm": minor
"@kanzo-tech/ai": patch
---

`generate` on `@kanzo-tech/llm`: a model's answer read whole — `{ text, output }` from the same options as `stream`, plus `providerOptions` — asked once, so a refusal rejects with what the model threw and is never retried. `runTask` and `propose` from `@kanzo-tech/ai/task` ask through it, so a Task no longer retries a failed model call twice before it fails: the first failure is the one you see. Nothing to change on your side.
