---
"@kanzo-tech/llm": minor
"@kanzo-tech/ai": patch
---

The failure `@kanzo-tech/llm` names is `LlmError`, coded `llm/unavailable`, so its area is the package's name.

**Breaking:** `AiError` is `LlmError`, and `ai/unavailable` is `llm/unavailable` — rename both where you catch the error or key your error registry on the code. `data.reason` is unchanged. `ModelBadge` offers no retry for `llm/unavailable`, as it did for the old code.
