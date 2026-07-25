---
"@kanzo-tech/ui": minor
---

**AI-assist is two composed compounds over the headless engine hooks; the core inputs stay pure.**

`Complete` composes inline ghost completion over a bare `Input`/`Textarea`: `CompleteRoot` owns the controlled value and the `useCompletion` stream, `CompleteInput`/`CompleteTextarea` delegate to the primitive via `asChild`, `CompleteGhost` paints a muted continuation at the caret (single line) and `CompleteHint` streams it below the field (prose). Tab accepts, Esc dismisses.

`Suggest` is a candidate-menu compound: `SuggestRoot` owns the `useSuggestions` stream and open state, `SuggestTrigger` is the ✨ button, `SuggestContent` the portaled popover of candidates (`SuggestItem` per row). It takes `suggest` / `existing` / `onPick`.

`useCompletion` / `useSuggestions` / `useAiStream` stay exposed for fully custom surfaces. The metadata-form showcase composes both over `Field`, `Textarea`, and `TagsInput`.
