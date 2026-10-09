---
"@kanzo-tech/graph": patch
---

**A camera following a large layout no longer holds the page's main thread on software WebGL.** The
re-frame reads every position back synchronously, and on SwiftShader (headless Chromium's fallback)
at 206,629 vertices each read stalled about two seconds; asked for every 900 ms, it left the page 1%
of its main thread, so DuckDB-WASM replies and anything else on the page waited behind it. The camera
now waits ten times its last stall before the next re-frame — 900 ms on a GPU, as before. Nothing to
change in your code.
