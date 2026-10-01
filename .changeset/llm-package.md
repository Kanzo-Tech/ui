---
"@kanzo-tech/llm": minor
---

New package: `@kanzo-tech/llm`, the model side of `@kanzo-tech/ai`, without React. `createKanzo({ baseURL })` gives you a model by alias from an OpenAI-compatible Kanzo AI gateway — `const kanzo = createKanzo({ baseURL: "/api/v1/ai" }); kanzo("kanzo-chat")` — and the AI SDK pieces you build on it (`ToolLoopAgent`, `DirectChatTransport`, `tool`, `Output`, `streamText`, the message types) are re-exported, so you import them from here rather than from `ai`. Install `ai@^7` beside it; it is a required peer.
