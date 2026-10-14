---
"@kanzo-tech/llm": minor
---

`localModel` resolves every model through one provider registry, which your app sets once.

- At your composition root, before anything asks a model: `setLocalProvider(localProvider({ baseURL: "/models", worker }))`. The page then serves every model listed in `/models/app-config.json` — WebLLM's own `AppConfig`, `{ model_list: [{ model, model_id, model_lib, … }] }` — with `model` and `model_lib` resolved against `/models` when they are relative. Write that file wherever you download the models.
- `localModel()`, `loadLocalModel()` and `localModelLoad()` without an id ask the first model listed; pass an id for another.
- Without a provider of yours, `localModel(id)` is WebLLM's prebuilt list from Hugging Face, as before.
- A missing or empty `app-config.json`, or an id it does not list, fails as `LlmError` `llm/unavailable` with `data.reason` `"unserved"`.

**Breaking:**

- `localModel(id, settings)` and `loadLocalModel(id, settings)` take no settings, and `LocalModelSettings` is gone. Move `worker` to `localProvider({ worker })`.
- `from: { weights, library }` is gone. List the model in `app-config.json` under your `baseURL` instead: `model` is the weights' URL and `model_lib` the library's, and whatever WebLLM's prebuilt record said of the model — its `overrides`, among them the context window — is that entry's to say now.
- If your app chose the model's URL in code — an environment variable, a context provider, a branch for a test double — delete it: the provider's `baseURL` is where the models are, and an end-to-end test registers its double with `playwright(page, { models })`.
