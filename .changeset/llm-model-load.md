---
"@kanzo-tech/llm": minor
---

A local model's download and load is now something you read rather than a callback you pass: `localModelLoad(id)` from `@kanzo-tech/llm/local` answers where it stands — `{ state: "idle" }`, `{ state: "loading", progress, text }`, `{ state: "ready" }` or `{ state: "failed", error }`, the `ModelLoad` type on `@kanzo-tech/llm` — whichever screen started it, and `watchLocalModel(id, listener)` says when it changes, so `useSyncExternalStore((l) => watchLocalModel(id, l), () => localModelLoad(id))` is the whole subscription. **Breaking:** `LocalModelSettings.onProgress` is gone; a host that kept its own store from it reads `localModelLoad` instead, and draws it with `@kanzo-tech/ai`'s `ModelStatus`.
