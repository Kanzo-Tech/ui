---
"@kanzo-tech/ui": minor
---

A dashboard's fields come from what the data says of them. Over a fossil corpus's join graph, `useFieldStats` reads each column's description and the counts fossil's writer stored, and queries nothing; it runs one `SUMMARIZE` only for a relation nothing counted, keeping what the joins say each column is. A field is an identifier when the data declares it — the writer's key, identity or endpoint column, an IRI, or a candidate key — and a year stored as an integer whose datatype is `xsd:gYear` is a time. `FieldStat` carries its commonest `values`, its `annotations` and its `label`, and a tile's title and `RelationPicker`'s sentences read the data's labels in the page's language.

**Breaking:** a column named `id`, `uri` or `iri` is no longer an identifier because of its name, and a text with more than 50 values is no longer one because of its count. If a field your dashboard searched is now a dimension or a measure, declare it — in the shape, or as a `candidateKeys` entry of a type in the joins you hand `MosaicProvider` — or `exclude` it.

**Breaking:** `useFieldStats(relation)` takes the relation as `ChartRoot` does — a table by name, a path over the provider's joins, or SQL. `fieldStats(columns, options)` takes column descriptions (`FieldColumn`: a `JoinColumn`, and whether it is a candidate key), not `SUMMARIZE` rows: describe a relation of your graph with `relationColumns(graph, relation)`. `SummarizeRow` is gone.
