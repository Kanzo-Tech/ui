---
"@kanzo-tech/llm": minor
---

`localModel(id, { from: { weights, library } })` loads the model from where you serve it — its MLC weights directory and its compiled `.wasm` — rather than from WebLLM's prebuilt list on Hugging Face. An id that is in that list keeps the list's settings for it — its `overrides` (the context window among them), `vram_required_MB`, `low_resource_required`, `required_features` — so a model you serve runs as the prebuilt one would and needs no more memory. `loadLocalModel(id, settings)` downloads and loads it before the first call, on the same engine, and rejects as a call would. The first load asks the browser to persist the page's storage, so the weights are not evicted under pressure.
