---
"@kanzo-tech/llm": minor
"@kanzo-tech/ai": minor
---

**Breaking.** `createKanzo` is `createGateway`, and its types are `Gateway` and `GatewaySettings`: what it reaches is your AI gateway, whoever serves the models behind it. Rename the call — `const gateway = createGateway({ baseURL })` — and name your gateway's aliases by what they are for; the docs use `gateway("chat")` and `gateway("complete")`.
