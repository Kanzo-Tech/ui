---
"@kanzo-tech/ai": minor
---

**Breaking.** `@kanzo-tech/ai` is now two components over the AI SDK: `Assist` for a field the model helps fill, and `Chat` for a conversation. Install the new required peers `ai@^7` and `@ai-sdk/react@^4`.

- **Assisted fields.** Replace `CompleteRoot`/`CompleteTextarea`/`CompleteGhost`/`CompleteMark`/`CompleteKeys`/`CompleteHint`/`CompleteError` and `SuggestRoot`/`SuggestMark`/`SuggestList` with one `AssistProvider` (once, with `model={kanzo("kanzo-complete")}`) and `<Assist value onValueChange><Textarea /></Assist>` around the control. A `Textarea` gets the same ghost text (plus Alt+]/Alt+[ for alternatives and an undo on the ✨), an `Input` gets the same strip of candidates, a `TagsInput` gets candidates to add. You no longer write a `complete` or `suggest` source: the field's label and helper text tell the model what it is — use `FieldHelper`, which is wired to the control. Words move to `AssistProvider`'s `translations`.
- **Conversations.** Replace your composition of `Conversation`, `Message`, `MessageText`, `PromptInput`, `Reasoning`, `Tool` and `Task` with `<Chat chat={useChat({ transport })} tools={{ myTool: (part) => … }} />`. Parts are the AI SDK's own, so there is nothing to translate; tool states are the SDK's.
- **Removed**, with no replacement export: those parts, `MessageMarkdown` and the `./markdown` subpath (markdown is built into `Chat`), `useAiStream`, `useInlineCompletion`, `useSuggestions`, `cleanGhost`, `Candidate`, `AiMessage`/`Ai*Part`/`StreamState` and their guards, `RunState`, `AiStatus`.
