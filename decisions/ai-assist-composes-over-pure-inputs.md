# AI-assist composes over the pure inputs

- **Status** live — 2026-07-24
- **Decided** Two compounds — `Complete` over `Input` / `Textarea` via `asChild`, and `Suggest`, a
  candidate popover — with the engine in two headless hooks. No `complete` prop on the primitives,
  no `AiAssist` provider, no field context.
- **Because** a prop on `Input` welds the model into the primitive: the core stops being
  Shark-verbatim and imports the engine. A provider would only earn its place by unifying state
  across consumers, and there is nothing to unify.
- **Reversed by** a real second consumer with shared AI state. Gate any provider on that, not on a
  hypothesis.
- **Held by** `packages/ui/src/simples/complete.tsx`, `simples/suggest.tsx`, `simples/use-ai.ts`;
  `packages/ui/src/index.test.ts`, the `AiAssist` / `FieldSuggest` / `useAiField` tombstones

This is the ladder's rungs three and four chosen over rung one deliberately, and the extra rung
buys core purity. It is also the third design of this feature; the first two were the prop and the
provider.
