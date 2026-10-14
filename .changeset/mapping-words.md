---
"@kanzo-tech/mosaic": minor
"@kanzo-tech/ui": patch
---

`withMapping(graph, mapping.model())` describes a `JoinGraph` by the RML-Core mapping written beside
it: the class, predicate, term type, datatype and `rdfs:label`s the mapping states are put on the
graph's `iri`, `annotations`, `termType` and `datatype`, so `RelationPicker`, Ask, a column's `label`
and a year declared `xsd:gYear` read them with no other change. Pass the result wherever you passed
the graph. `MappingModel` is a structural type — rudof's `Mapping.model()` answers it — so nothing
imports rudof. A field now also reads RML-Core's term types (`IRI`, `UnsafeIRI`, `BlankNode`) as names,
beside R2RML's `rr:` ones.

New: `typeWords(graph, name, language?)` and `edgeWords(edge, language?)`, a type's or an edge's label
in the page's language, else its name in words.
