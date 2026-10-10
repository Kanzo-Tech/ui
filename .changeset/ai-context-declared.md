---
"@kanzo-tech/ai": patch
---

**Each alias's context is declared once, by the platform.** The AI services (`services/ai`) take
`AI_CHAT_CONTEXT` and `AI_COMPLETE_CONTEXT`, each alias's window in tokens, beside `AI_CHAT` and
`AI_COMPLETE`. With the `local-models` profile they are what Model Runner starts the model with
(`context_size`, still 8192 when unset). With a provider they are its window, which the operator
sets. The gateway reports no window: Model Runner's `/models` gives a model's maximum, not what it was
started with. So the number an application passes to `dataAgent` / `dataSuggestions` as
`context: { tokens }` comes from the same variables.

**What to change:** pass them to your server's environment, for example
`MYAPP_AI_CHAT_CONTEXT: ${AI_CHAT_CONTEXT:-}`, and hand them to `context`. Unset, nothing narrows, as
before. A compose file that set a model's `context_size` itself sets the variable instead, so the
model and the application read one number.
