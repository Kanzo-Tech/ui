---
"@kanzo-tech/ui": minor
---

`PreferencesRoot` takes every prop of Ark's `Dialog` root, so the panel can be controlled: pass `open` and `onOpenChange` to open it from elsewhere. `hotkey` works in both modes, and with `open` it asks through `onOpenChange` instead of opening the panel itself. It is still non-modal unless you pass `modal`.

`Questionnaire` takes `step`, the question on screen controlled, beside `defaultStep` and `onStepChange` — as on Ark's `Steps`.
