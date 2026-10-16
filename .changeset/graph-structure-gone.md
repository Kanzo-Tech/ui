---
"@kanzo-tech/graph": minor
---

`GraphState.structure` is the graph's `JoinGraph` (from `@kanzo-tech/relations`), not a `Structure`.
Where you read `structure.vertices`, read `structure.types` without the union (`type.of === undefined`);
`first` and `rows` are on each type, a column is `type.columns.find((c) => c.name === name)`, its
primary key is the column whose `role` is `"identity"`, and `structure.size` is the sum of the vertex
types' `rows`. `structure.from` is gone: the catalog is the `from` you passed.
