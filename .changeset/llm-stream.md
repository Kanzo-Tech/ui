---
"@kanzo-tech/llm": minor
---

**`stream`, the one door to a model's answer.** `stream({ model, system, prompt, output, abortSignal })`
reads one answer as `text`, as `elements` (an `Output.array`, each once it is whole) or as `partial`
(an `Output.object` as it grows). Each reading **throws what stopped the model** once it ends, and
the request is never retried.

**Breaking:** `streamText` is no longer re-exported. Replace

```ts
const result = streamText({ model, prompt, output, onError });
for await (const e of result.elementStream) …
```

with

```ts
for await (const e of stream({ model, prompt, output }).elements) …
```

and drop the `onError`: the failure now arrives as a thrown error from the loop.

**A gateway's 429 is now an `AiError` coded `ai/rate-limited`**, with `data.retryAfter` in seconds
when the gateway sent `retry-after` or `x-ratelimit-reset`. It used to surface as the provider's
uncoded error. `AiError["code"]` is now `"ai/silent" | "ai/rate-limited"`: a `switch` over it that
must be exhaustive needs the new case.
