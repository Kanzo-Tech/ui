---
"@kanzo-tech/ai": minor
---

**A field whose model fails says so, and tells you.** A refused call or a broken stream used to end
as if the model had nothing to offer. Now the field shows the failure under itself — the error's
own message, or the new `failed` translation when it has none — and `AssistProvider`'s new
`onFailure(error: unknown)` receives what was thrown, whole. A model that sends nothing for 30 s —
before its first word or between two — is cut off and arrives as an `AiError` (exported) whose
`code` is `"ai/silent"` and whose `data.after` is `30000`. Branch on `error.code` in your failure
view; set `translations.failed` if you translate the field.
