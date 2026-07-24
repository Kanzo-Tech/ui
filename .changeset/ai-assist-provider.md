---
"@kanzo-tech/ui": minor
---

**AI-assist is now a single, decoupled, composable pattern.** A thin `AiAssist` provider (pure
context over the existing `useAiStream` hooks — no new machine) is mounted by `Field` when it
receives `complete`/`suggest`/`existing`/`onPick`. Surfaces opt in: `Input` and `Textarea` gain
`aiComplete` (an overlay ghost — Tab accepts, Esc dismisses, end-of-value + fit gating with a hint
fallback); the ✨ candidate popover is a composable `FieldSuggest` part reading the provider. So
`complete`/`suggest` are declared once on `Field` and any control picks them up — the 70-line
`SuggestKeywords` composition is gone.

**`CodeEditor` is a plain code editor again** — all AI/ghost functionality (`complete`,
`completionHint`, `cm-ghost.ts`) removed. Inline completion lives only on the form surfaces
(`Input`/`Textarea`); a code editor is deliberately not fully-featured.

The metadata-form showcase uses the new pattern: Description → `<Textarea aiComplete>` (prose, not a
monospace editor), Keywords → `<Field suggest onPick>` + `<FieldSuggest>` feeding the TagsInput.
