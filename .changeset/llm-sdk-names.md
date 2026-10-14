---
"@kanzo-tech/llm": minor
---

`@kanzo-tech/llm` no longer re-exports the AI SDK. It carries `stream`, `generate`, `LlmError` and `ModelLoad`, and nothing of `ai`'s.

**Breaking:** import the SDK's names from `ai`, which you already install as a required peer — `ToolLoopAgent`, `stepCountIs`, `tool`, `jsonSchema`, `Output`, `DirectChatTransport`, `getToolName`, `isToolUIPart`, and the types `Agent`, `ChatStatus`, `DynamicToolUIPart`, `InferAgentUIMessage`, `LanguageModel`, `ReasoningUIPart`, `Tool`, `ToolSet`, `ToolUIPart` and `UIMessage`: `import { ToolLoopAgent, tool, type LanguageModel } from "ai"`.
