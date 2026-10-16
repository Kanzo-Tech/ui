---
"@kanzo-tech/graph": minor
"@kanzo-tech/relations": minor
---

`GraphRoot` and `useGraph` take `mapping`, the graph's RML mapping as rudof's `Mapping.model()`
answers it. The Timeline setting then offers a year stored as a number (`xsd:gYear` over an `int32`,
like the Nobel award's `date`) again, as it did before 0.47; without `mapping` it offers only `date`
and `timestamp` columns. The mapping may arrive after the graph has drawn. New in
`@kanzo-tech/relations`: `TEMPORAL_DATATYPES`, the datatypes the dashboard and the timeline read as a time.
