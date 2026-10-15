---
"@kanzo-tech/llm": minor
---

`loadLocalModel` now ends with one tiny structured generation, so the engine's first-use work
(XGrammar's token table, the GPU's first run) is done before the first question rather than during
it; `ready` is published after it, and the load text reads "Warming up" meanwhile. A warm-up that
fails does not fail the load. This is reasoned, not measured: the load, the warm-up and the first
call are `performance.measure` spans named `kanzo:llm:load`, `kanzo:llm:warm-up` and
`kanzo:llm:first-call` in the browser's Performance timeline, so you can read the effect on your
device.
