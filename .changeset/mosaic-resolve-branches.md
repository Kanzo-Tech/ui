---
"@kanzo-tech/mosaic": minor
---

`resolveRelation` reads a filter off the path: `RelationNeeds` takes `filters`, the types an answer's conditions are on, and a type the path has no step of is reached by a branch from the step nearest to it — *Physics awards by university* (`Award→Category`, `Award→Affiliation→University`) now resolves where it answered `unreachable`. A resolved answer is a `Resolution`, `{ relation, through }`, with the branches in `through`; `ambiguous` holds `options: Resolution[]` in place of `relations: Relation[]`. A host that read `resolved.relations` reads `resolved.options.map((o) => o.relation)`; one that passed a filter's type in `types` passes it in `filters`, unless the answer shows it.
