---
"@kanzo-tech/ai": minor
---

The composer's button and a tool call's state badge take translations. `PromptInputSubmit` takes
`translations` (`send`, `stop`, `retry`, typed `PromptInputSubmitTranslations`), `Tool` takes
`translations` (a label per AI SDK tool state, keyed by the state, plus `stopped`, typed
`ToolTranslations`), and `Chat`'s `translations` now carries both, so a translated chat no longer
reads *Send*, *Running* or *Stopped* in English.
