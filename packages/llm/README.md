# @kanzo-tech/llm

The model conversation, without React.

```bash
npm install @kanzo-tech/llm ai
```

`ai` is a **required** peer, not an optional one: there is nothing here without it, and a host
installs it once so that its own agent and `@kanzo-tech/ai`'s components share one `UIMessage`, one
`ToolLoopAgent` and one transport. Same standing `@uwdata/mosaic-*` have in `@kanzo-tech/mosaic`.

## What it holds

```ts
import { createGateway } from "@kanzo-tech/llm";
import { ToolLoopAgent, DirectChatTransport, tool, Output, streamText } from "@kanzo-tech/llm";
```

- **`createGateway({ baseURL })`** — the one door to a model. `gateway("chat")` is a model by
  **alias**: which upstream answers it is the gateway's configuration, so a host's code is the same
  in development (a local model) and in production. The gateway speaks OpenAI chat completions; its
  key belongs to a server, so `baseURL` is normally the host's own authenticated proxy — keasy's is
  `/api/v1/ai` — and a relative one is resolved against the page. Two things a host would otherwise
  repeat happen here: a model that reasons inline in `<think>…</think>` (Hermes, DeepSeek, Qwen)
  gets that lifted into the SDK's `reasoning` part, and structured output is on, so `Output.array`
  asks the gateway for a JSON schema rather than prose to parse. And a streaming request that sends
  nothing for 30 s — no headers, or no chunk since the last — is aborted and fails as an `AiError`
  coded `ai/silent`.
- **Re-exports** of the AI SDK surface a host needs — the agent, the transport, `tool`, `Output`,
  `streamText`, and the message and part types — so a host never imports `ai` itself.
  `@ai-sdk/openai-compatible` is not among them: `createGateway` is the only way to a model.

## Why it is not part of `@kanzo-tech/ai`

Reaching a model is not a user-interface concern, and not every caller draws one: a host's agent,
a server route or a test needs the model and none of the components. `@kanzo-tech/ai` depends on
this package and not the other way round.
