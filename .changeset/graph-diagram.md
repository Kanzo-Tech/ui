---
"@kanzo-tech/graph": minor
---

`@kanzo-tech/graph/diagram` is new: `DiagramRoot`, `DiagramCanvas` and `DiagramControls` draw a small
directed graph of your own — nodes by id, edges `{ id, source, target, label? }`, each node your own
markup through `DiagramCanvas`'s render prop — laid out in layers, with selection (`selected`,
`onSelect`), zoom and fit. Install `@xyflow/react` (^12.12.0) and `elkjs` (^0.12.0) to use it; both are
optional peers and nothing else in the package reaches them. `elkjs` is licensed EPL-2.0 OR
GPL-3.0-or-later. The layout runs in a worker your bundler emits from `elkjs`'s published script, so a
Content-Security-Policy needs `worker-src 'self'`.
