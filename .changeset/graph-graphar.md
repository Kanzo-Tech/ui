---
"@kanzo-tech/graph": minor
---

**Breaking:** `GraphRoot`, `readJoinGraph` and every part read an Apache GraphAr graph attached by `@kanzo-tech/graphar-duckdb`'s `attachGraph`, not a `fossil/1` corpus attached by `@fossil-lang/corpus`'s `attach`. Attach the graph with `attachGraph(engine, name, resolve, { entry: "fossil.graph.yml" })` and pass the same `name` as `from`; a corpus attached by `@fossil-lang/corpus` no longer reads (its `fossil_tables` are not looked for). The graph reads `graphar_vertex_types`, `graphar_edge_types`, `graphar_properties` and a view per type, and still imports nothing of the package that attached them.

What you see changes where GraphAr states less than fossil's manifest did:

- `dense_id` is still every vertex's id, `0 … V − 1`, and still what a pick and a `clauseSemiJoin` name — it is now the graph's own, computed from GraphAr's per-type `_graphArVertexIndex` in the graph document's order of the types. Read ids from the join graph's type tables (`readJoinGraph(…).types[i].table`), not from `"<name>"."<type>"`, whose rows carry GraphAr's per-type index. An edge type's `src` and `dst` are global ids there too.
- A vertex type is drawn when it has a primary key, and that key is its identity. A vertex type without one — a multi-valued property — is neither drawn nor in the join graph, so a dashboard, `RelationPicker` or Ask can no longer reach a path such as `nickname`.
- The join graph's columns carry their DuckDB type, `nullable`, and a `role` for the two keys (`address` for `dense_id`, `identity` for the primary key), which are each type's `candidateKeys`. They carry no `iri`, `termType`, `datatype`, annotations or `stats`: a field is called by its name, `useFieldStats` reads a relation with one `SUMMARIZE`, and a year stored as an integer is a number — the timeline offers GraphAr `date` and `timestamp` columns only.
- `GraphState.structure` changed shape: a type's columns are `{ type, primary, nullable }`, each type and edge has a `table` (its rows under global ids), and `key`, `properties`, `candidateKeys`, `iri`, `annotations`, `sourceKey` and `destinationKey` are gone.
