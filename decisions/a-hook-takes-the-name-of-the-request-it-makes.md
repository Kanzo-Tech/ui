# A hook takes the name of the request it makes

- **Status** live — 2026-08-21
- **Decided** The ghost-text hook is `useInlineCompletion`, and its surface types are
  `InlineCompletion`, `InlineCompletionRequest`, `InlineCompletionTrigger` and
  `UseInlineCompletionOptions`. The `Complete` compound keeps its name.
- **Because** We took the semantics of `textDocument/inlineCompletion` and the identifier of
  `textDocument/completion`.
- **Reversed by** LSP collapsing the two requests into one, or a second hook here whose semantics
  are the plain request's — a list of candidates the caller picks from — which would then own the
  short name.
- **Held by** `packages/ai/src/index.ts`, `useInlineCompletion`; `packages/ui/src/index.test.ts`,
  "drops components superseded by composition or a merge", `!useInlineCompletion`;
  `packages/ui/src/documented-exports.test.ts`, "documents no symbol the library does not export"

LSP 3.18 ships `textDocument/completion` and `textDocument/inlineCompletion` as two requests, and
the split is not cosmetic: the first returns a list the editor presents and the user picks from,
the second returns text drawn where the caret is and accepted whole. Ours is the second, and the
hook's own doc comments already said so — they cite `InlineCompletionTriggerKind` for the trigger
union, `filterText` for the rule that keeps an offer alive while what has been typed agrees with
it, and Monaco's `inlineSuggest.mode: "prefix"` for the same rule under another name. Three
citations to the inline request, under the identifier of the other one.

The AI SDK's `useCompletion` is a different hook with the same old name — it owns an HTTP endpoint
and the field's value, ours owns neither — and that collision is real, but it is not the argument.
A name is wrong because it names the wrong thing, not because somebody else took it. The collision
note moved to `.changeset/the-first-release.md`, where it is addressed to a consumer choosing
between two imports; the docs page no longer carries it, because a page that spends a callout on
another library's hook is teaching the wrong subject.

**The `Complete` compound did not move, and that is the case that does not fit.** By the same
argument it should be `InlineComplete`. It collides with nothing — the AI SDK ships no `Complete`,
and neither does Shark — and the rename is three times the diff of this one for zero collisions
solved and no clarity gained: a compound named `Complete` over an `Input`, drawing a ghost, is not
mistakable for a picker.

**`Complete` / `useInlineCompletion` is deliberately not a pair, and the old spelling was not one
either.** The house pattern is `X` / `useX` where the hook reads the compound's context —
`useDataTableContext` beside `DataTable`. This hook reads no context and is usable with any input;
`Complete` is one of its callers. The old `Complete` / `useCompletion` looked like the house pair
and never was, which is its own reason to break the resemblance.

What this does not touch: `MIN_COMPLETE_LENGTH`, which is not on the barrel and belongs to
`Complete`'s dead-press guard rather than to the request.
