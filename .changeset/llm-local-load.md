---
"@kanzo-tech/llm": minor
---

`localModel(id, { from: { weights, library } })` loads the model from where you serve it — its MLC weights directory and its compiled `.wasm` — rather than from WebLLM's prebuilt list on Hugging Face. `loadLocalModel(id, settings)` downloads and loads it before the first call, on the same engine, and rejects as a call would. The first load asks the browser to persist the page's storage, so the weights are not evicted under pressure.
