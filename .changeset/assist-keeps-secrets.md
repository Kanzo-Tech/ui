---
"@kanzo-tech/ai": minor
---

`Assist` no longer offers on, or reads, a password input or a control whose `autocomplete` is
`cc-*`, `one-time-code`, `current-password` or `new-password`: it draws no ✨ there and asks the
model nothing. `AssistEvent.proposal` is now optional and absent by default, so `onEvent` hears the
`kind` and the `field` and no text; if your telemetry read `event.proposal`, set `includeText` on
`AssistProvider` to keep it (and know that it then holds text the model wrote from what was typed).
