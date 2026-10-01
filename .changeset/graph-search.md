---
"@kanzo-tech/graph": minor
---

**`GraphSearch`: find a vertex by its text and go to it.** A new part under `GraphRoot`. It reads
every drawn vertex's `title` (or its table's `identity`) once, filters in the browser as the reader
types — no query per keystroke — orders matches by the `r` ramp so the hubs come first, names each
by the root's `categories`, and picking one calls `reveal`. Props: `limit` (default 50),
`placeholder`, `size`, `className`. If you wrote your own search over the corpus, `<GraphSearch />`
replaces it.
