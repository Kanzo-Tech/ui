# @kanzo-tech/llm

The two doors to a model's answer, without React.

```bash
npm install @kanzo-tech/llm ai
npm install @browser-ai/web-llm @mlc-ai/web-llm   # for localModel, a model in the page
```

`ai` is a **required** peer, not an optional one: there is nothing here without it, and a host
installs it once so that its own agent and `@kanzo-tech/ai`'s components share one `UIMessage` and
one transport. **None of it is re-exported**: import `ToolLoopAgent`, `tool`, `Output` and the
message types from `ai` by name, as every package here does.

## What it holds

```ts
import { generate, stream, LlmError } from "@kanzo-tech/llm";
import { localModel, localProvider, setLocalProvider, serveLocalModel } from "@kanzo-tech/llm/local";
import { scriptedModel } from "@kanzo-tech/llm/testing";
```

- **`stream({ model, system, prompt, output })`** — an answer as it is written: `streamText`, never
  retried, read as `text`, `elements` (`Output.array`) or `partial` (`Output.object`), each of which
  **throws what stopped the model** once it ends. The SDK alone reports a failed stream to `onError`
  and ends it as if it had finished.
- **`generate({ …, providerOptions })`** — the same, read whole: `generateText`, asked once.
  Every model call the library makes goes through one of the two.
- **`LlmError`** — `llm/unavailable`, `data.reason` `"webgpu"` (the page cannot run a model) or
  `"unserved"` (nothing serves it).
- **`localModel(id?)`**, from **`@kanzo-tech/llm/local`** — the model, in the page, resolved by id
  through one provider registry: a host sets its provider once,
  `setLocalProvider(localProvider({ baseURL: "/models", worker }))`, and every model listed in
  `/models/app-config.json` (WebLLM's `AppConfig`) is served; without an id, the first. WebLLM on
  WebGPU through `@browser-ai/web-llm`: both optional peers that only this subpath reaches. One
  engine per model per page; without WebGPU a call fails as `LlmError`, before anything is
  downloaded. A call may pass `providerOptions.kanzo.grammar`, an EBNF the engine holds every token
  to. `loadLocalModel(id?)` downloads and loads it before the first call, and `localModelLoad(id?)` /
  `watchLocalModel(id, listener)` say where that stands. `serveLocalModel()` is the worker's whole
  script.
- **`scriptedModel(script)`**, from **`@kanzo-tech/llm/testing`** — the one model double: the AI
  SDK's `MockLanguageModelV4` answering from a script of turns. A unit test passes it where a model
  goes; an end-to-end test registers the script with `@kanzo-tech/testing`'s
  `playwright(page, { models })`, which registers it as that id's provider in the same registry.

## Why it is not part of `@kanzo-tech/ai`

Reaching a model is not a user-interface concern, and not every caller draws one: a host's agent,
a server route or a test needs the model and none of the components. `@kanzo-tech/ai` depends on
this package and not the other way round.
