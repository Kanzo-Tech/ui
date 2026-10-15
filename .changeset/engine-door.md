---
"@kanzo-tech/graph": minor
"@kanzo-tech/ui": minor
"@kanzo-tech/mosaic": minor
---

`GraphRoot`, `MosaicProvider` and `useGraph` take `engine`, not `coordinator`; Stop on the graph now
stops the statement.

- Pass `engine()`'s engine where you passed its coordinator: `<MosaicProvider engine={e}>`,
  `<GraphRoot engine={e} from="archive">`, `useGraph({ engine: e, … })`. The same engine goes to Ask.
- `Engine` has no `coordinator` any more, and no host holds one. A statement of your own is
  `engine.query(sql, { signal })`; load a table with `engine.query(String(loadObjects(…)), { signal })` where
  you wrote `coordinator.exec(…)`.
- `useMosaic()` and `useChartContext()` answer `engine` where they answered `coordinator`.
- `readJoinGraph(engine, from, signal?)` takes the engine, and a signal that stops it.
- The graph's own reads — the catalog, the links, the columns, a search, the inspector's row, a
  label — run on `engine.query` with a signal: leaving a graph, changing `from`, focusing another
  vertex or typing on interrupts the statement in DuckDB, and the connection answers the next read
  at once. They are no longer in the coordinator's cache, so a page that draws a graph and builds its
  join graph reads the catalog twice. The graph's filter and every chart still read through the
  coordinator inside the engine.
- A Mosaic coordinator over a socket or REST connector is no longer accepted by `MosaicProvider`.
