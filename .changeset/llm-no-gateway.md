---
"@kanzo-tech/llm": minor
"@kanzo-tech/ai": patch
---

`createGateway`, `Gateway` and `GatewaySettings` are gone from `@kanzo-tech/llm`, and with them its dependency on `@ai-sdk/openai-compatible`. The model is `localModel`, from `@kanzo-tech/llm/local`, in the page; any other `LanguageModel` still works everywhere one is taken. `AiError` has one code left, `ai/unavailable` (`data.reason`); `ai/silent` and `ai/rate-limited`, and the `after`, `retryAfter` and `status` data, were the gateway's and went with it. A host that branched on them drops those branches.
