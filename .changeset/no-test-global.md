---
"@kanzo-tech/graph": minor
"@kanzo-tech/testing": minor
---

`window.__KANZO_TESTING__` is gone: nothing in the library looks for a test any more.

- `GraphCanvas`'s element (the one with `data-frame`) says where it draws, on every page:
  `element.screenOf(vertex)` and `element.screenAt({ x, y })`, in pixels from its top-left corner, `NaN`
  before it has drawn. `GraphCanvasHarness` reads them there, so `lasso`, `marquee` and `screenOf` work
  as before, and on a page that loaded before the environment was made.
- What a scripted model was asked is `await env.prompts(modelId)`. If you read
  `window.__KANZO_TESTING__.models.get(id).prompts`, call that instead.
- `KanzoTestingHook`, `GraphProbe` and `ModelProbe` are removed from `@kanzo-tech/testing`. If you read
  `hook.graphs.get(id)`, read `screenOf`/`screenAt` off the canvas element.
