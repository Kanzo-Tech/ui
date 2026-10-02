---
"@kanzo-tech/mosaic": patch
---

**`engine().query` answers in a background tab.** It went through the coordinator's queue, which
batches Arrow requests behind `requestAnimationFrame` — and a hidden tab never paints one, so a
corpus opened while the tab was in the background (fossil's `open`: the secret, the attach, the
views) waited forever with no error, and a host's statement could sit behind a batch of chart
queries. It now goes straight to the connection and is decoded as the coordinator decodes. Charts
still batch as before. A refused statement still rejects with DuckDB's own error. Nothing to change
in your code.
