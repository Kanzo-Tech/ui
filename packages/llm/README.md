# @kanzo-tech/llm

The model conversation, without React.

```bash
npm install @kanzo-tech/llm ai
npm install @browser-ai/web-llm @mlc-ai/web-llm   # for localModel, a model in the page
```

`ai` is a **required** peer, not an optional one: there is nothing here without it, and a host
installs it once so that its own agent and `@kanzo-tech/ai`'s components share one `UIMessage`, one
`ToolLoopAgent` and one transport. Same standing `@uwdata/mosaic-*` have in `@kanzo-tech/mosaic`.

## What it holds

```ts
import { stream, ToolLoopAgent, DirectChatTransport, tool, Output } from "@kanzo-tech/llm";
import { localModel, serveLocalModel } from "@kanzo-tech/llm/local";
```

- **`localModel(id, { worker, onProgress })`**, from **`@kanzo-tech/llm/local`** — the model, in the
  page, on WebGPU through WebLLM and `@browser-ai/web-llm`: both optional peers that only this subpath
  reaches. One engine per model per page; without WebGPU a call fails as an `AiError` coded
  `ai/unavailable`, `data.reason` `"webgpu"`, before anything is downloaded. A model that reasons
  inline in `<think>…</think>` (Qwen3, DeepSeek) gets that lifted into the SDK's `reasoning` part.
  A call may pass `providerOptions.kanzo.grammar`, an EBNF the engine holds every token to — how a
  Task whose artefact is text in a language gets text in that language. `serveLocalModel()` is the
  worker's whole script.
- **`stream({ model, system, prompt, output })`** — the one door to an answer: `streamText`, never
  retried, read as `text`, `elements` (`Output.array`) or `partial` (`Output.object`), each of which
  **throws what stopped the model** once it ends. The SDK alone reports a failed stream to `onError`
  and ends it as if it had finished, so `streamText` is not re-exported: the raw call is the one that
  passes a refusal off as a short answer.
- **Re-exports** of the AI SDK surface a host needs — the agent, the transport, `tool`, `Output`,
  and the message and part types — so a host never imports `ai` itself.

## Why it is not part of `@kanzo-tech/ai`

Reaching a model is not a user-interface concern, and not every caller draws one: a host's agent,
a server route or a test needs the model and none of the components. `@kanzo-tech/ai` depends on
this package and not the other way round.
