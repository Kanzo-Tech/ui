---
"@kanzo-tech/mosaic": minor
---

A join graph describes its columns. `JoinType.columns` are `JoinColumn`s — a column's `name` and DuckDB `type`, and, where its catalog states them, its `role`, `datatype`, `termType`, `iri`, `nullable`, `annotations` (`JoinAnnotation`) and what its writer counted (`stats`, a `JoinColumnStats`); a type and an edge may carry `iri` and `annotations`, and a type `candidateKeys`. `relationColumns(graph, relation, language?)` describes the columns a relation reads, under the names it reads them by, each with the `label` the data gives it. A multi-valued property is a type with a `value`, reached by an edge whose `table` is its own: the hop is one join, and the path to it names its value. `labelOf(annotations, language?)` reads a thing's `rdfs:label` in the page's language, `namingColumn(type)` the column whose property is a labelling property, and `splitWords(name)` is the last resort for a name nothing labels.

**Breaking:** a `JoinType`'s `columns` are descriptions, not names: write `columns: [{ name: "country", type: "VARCHAR" }]` where you wrote `columns: ["country"]`, and include the key column if you have its type. A graph built from a fossil corpus comes from `@kanzo-tech/graph`'s `readJoinGraph`; build it there rather than by hand.
