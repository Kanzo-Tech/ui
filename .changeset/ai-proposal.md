---
"@kanzo-tech/ai": minor
---

**One type for everything a model offers: `Proposal`.** A suggested question and a field's candidate
are the same `{ text, rationale?, range? }` now.

**Breaking:**

- `SuggestedQuestion` is removed. `suggest()` and `dataSuggestions()` yield `Proposal`s: read
  `.text` where you read `.question`.
- `Chat`'s `suggestions` takes `readonly Proposal[]` instead of `readonly string[]`. Pass the
  proposals `suggest()` yields as they are, or wrap a fixed list: `questions.map((text) => ({ text }))`.
- A model mocked for `Assist`'s candidates answers `{ elements: [{ text, rationale }] }`, not
  `{ value, rationale }`.
