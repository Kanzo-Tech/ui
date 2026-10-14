---
"@kanzo-tech/graph": minor
---

`readJoinGraph` describes every column of a corpus as its catalog does — its DuckDB type, `role`, `datatype`, `termType`, `iri`, whether it is `nullable`, its annotations (its `rdfs:label` among them) and what fossil's writer counted in it (`stats`) — and each type's `candidateKeys`, `iri` and annotations. An edge's label and its endpoint columns are read from `fossil_tables`, never parsed from the table's name or assumed to be `src` and `dst`. A multi-valued property's table is now part of the graph: a type of a row per value, reached from its source by a hop named by the property, so a dashboard, `RelationPicker` and Ask can reach it. The catalog is read once per corpus, for the canvas and the join graph alike.

**Breaking:** the graph reads the catalog `@fossil-lang/corpus` `0.3.0-alpha.32` attaches — `fossil_tables` with `label`, `source_key`, `destination_key` and `candidate_keys`, `fossil_columns` with `term_type`, and `fossil_annotations` and `fossil_stats`. Upgrade `@fossil-lang/corpus` to `^0.3.0-alpha.32`; a corpus attached by an older one does not read.
