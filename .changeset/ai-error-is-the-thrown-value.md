---
"@kanzo-tech/ai": minor
---

**`error` is the value the source threw, not its message.** On `useAiStream`, `useInlineCompletion`
and `useSuggestions`, `error` is now `unknown` — the thrown value, whole, with its `code` and
`data` if it had them — set while `status` is `"error"` and `undefined` otherwise. Where you
rendered `{error}`, render `{error instanceof Error ? error.message : "…"}`; where you tested
`error !== null`, test `status === "error"`; to choose the words by failure, branch on `error.code`.
`useAiStream` no longer takes a fallback message: write that word where you render.

`CompleteError` takes a function of the thrown value as its children, and `SuggestList` takes one
as `failure`; both still print the error's message when given none.

**A stream that goes quiet now ends.** A source that sends nothing for 30 s — before its first
chunk or between two — is aborted, and the run ends in `"error"` with an `AiError` whose `code` is
`"ai/silent"` and whose `data.after` is `30000`. Every chunk restarts the 30 s. `AiError` is
exported. A run whose `each` throws ends in `"error"` with that value instead of loading forever. An
inline completion that fails no longer leaves its half-streamed ghost on offer: the
ghost clears and the failure is `error`.
