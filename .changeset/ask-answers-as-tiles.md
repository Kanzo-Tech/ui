---
"@kanzo-tech/ai": minor
"@kanzo-tech/ui": minor
---

**`@kanzo-tech/ai/data` answers with a dashboard tile, not SQL.** The model no longer writes a query:
it fills an `Answer` — a relation of your join graph, the conditions a dashboard's filters publish,
and a `Tile` — from names the page generated, and the tile is read with what the dashboard reads it
with, under the page's crossfilter. Breaking: `describeSchema`, `gateStatement`, `QueryResult`, the
`scope` option, `DataSchema`, `DataScope`, `SchemaReference`, `QueryOutput`, `QueryRefusal`,
`QueryAnswer` and the `query/refused` code are gone, and the tool is called `answer`, not `query`.
`@codemirror/lang-sql` is no longer a peer.

What an Ask panel changes (keasy's `ask-panel.tsx` is this list):

- **The schema.** In place of `describeSchema(coordinator, { catalog, exclude, references })` with
  `corpusReferences`, read the graph and the relations a reader may ask about, once per graph:
  ```ts
  const graph = await readJoinGraph(coordinator, graphId); // or useJoinGraph()
  const relations = await readAnswerRelations(coordinator, graph, [
    { root: type, path: [] },
    ...relationHops(graph, type).map(({ hop }) => ({ root: type, path: [hop] })),
  ]);
  ```
- **The agent.** `dataAgent({ model, coordinator, schema, scope, key })` is
  `dataAgent({ model, coordinator, graph, relations, selection: crossfilter })`. `scope` was
  `{ selection, table }`; only the selection is passed now, and `key` is gone — the relation's root
  key is the graph's.
- **The pills.** `dataSuggestions({ model, schema, scope })` is
  `dataSuggestions({ model, graph, relations, selection: crossfilter })`; key the cache on
  `relations` and the predicate as before.
- **The card.** `tools={{ query: (part, { stopped }) => <QueryResult actions={…} part={part} stopped={stopped} /> }}`
  is `tools={{ answer: (part, { stopped }) => <AnswerCard graph={graph} onAdd={…} part={part} stopped={stopped} /> }}`.
  Its *Filter to it* replaces a host's *Add to the subset*: it publishes the answer's conditions as
  one semi-join on the root key, labelled *Ask*, so delete `AnswerActions` and its `usePick`. Pass
  `onAdd` to offer *Add to the dashboard*: it is called with the relation's key and
  `add(spec | undefined)`, which returns the spec with the tile appended — wire it to the store the
  Dashboard view saves, `change({ byRelation: { ...current.byRelation, [key]: add(current.byRelation[key]) } })`.
- **The types.** `QueryOutput` is `AnswerOutput` (`{ answer, rows, truncated, under }`); a refusal
  is the part's `errorText`, drawn by the card.

`@kanzo-tech/ui/analytics` exports `parseTile`, `measureExpr`, `bucketExpr`, `DASHBOARD_CHART_TYPES`
and `DASHBOARD_AGGREGATES`, what an answer compiles with. Nothing to edit.
