---
"@kanzo-tech/mosaic": minor
---

`JoinResolver` is the one door to the joins. Beside the page's crossfilter it now answers `steps(relation)` — each step's `path`, `type` and `key`, the root first — `paths(root, hops?)`, every field path from a type, `relation(root, shown)`, the one relation a set of paths lies on, `field(on, path)`, where a path is read for a relation — on it, or through the branch that leaves it — and `at(to, from)`; `crossing(from, predicates, to, at?)` takes the step to cross in at. A miss is a `JoinMiss` — `join/no-step`, `join/no-field` or `join/branches` — and the types are `JoinStep`, `JoinField` and `JoinMiss`. A path is Malloy's: an edge's label, `^label` back along an edge, the edge's name where two of one label leave a type, then the column — `affiliation.university.name`, `^laureate.category.name`.

**Breaking:** a relation's columns are named by their path from the root, not by their type: `relationQuery` writes `country` on the root, `knows.country` one hop away and `^hasCreator.length` back along an edge, where it wrote `Person.country`, `Person2.country` and `Post.length`. The root's key keeps its bare name, as before. Rename every field you name on a relation — in a clause, a tile, a filter — to its path, and delete saved dashboards whose fields are type-prefixed.

**Breaking:** `relationSteps`, `relationIdentities`, `relationRootKey`, `resolveRelation`, `RelationNeeds` and `Resolved` are gone. A step's key is `new JoinResolver(graph).steps(relation)` — `steps.map((s) => s.key)` is what a dashboard leaves out of its fields, `steps[0].key` the root's — and a question's relation is the paths it names, `resolver.relation(root, paths)`, not a search.
