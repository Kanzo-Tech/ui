---
"@kanzo-tech/ai": minor
---

**`Assist` asks once.** A field's request to the model is no longer retried when it fails, so
`onFailure` receives the first attempt's own error — a gateway's 504 as an `APICallError` with its
status and body — immediately, instead of the same request repeated twice more with backoff and a
`RetryError` around it.
