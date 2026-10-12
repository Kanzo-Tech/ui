---
"@kanzo-tech/llm": minor
---

`@kanzo-tech/llm/local` runs a model in the page: `localModel("Qwen3-4B-q4f16_1-MLC", { worker, onProgress })` is a `LanguageModel` on WebGPU, through WebLLM and `@browser-ai/web-llm`, which are optional peers only this subpath reaches — install them to use it, and nothing changes for a host that does not. Without WebGPU a call fails as `AiError` coded `ai/unavailable`. `serveLocalModel()` is the script of the worker the engine runs in.
