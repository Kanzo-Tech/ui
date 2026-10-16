---
"@kanzo-tech/relations": minor
"@kanzo-tech/kernel": patch
---

`readJoinGraph` and `withMapping` refuse a graph that contradicts itself with a `Problem`
`relations/invalid`: two types or two edges of one name, a type whose `key` is not one of its
`columns`, an edge whose `source` or `destination` is no type, or a union whose `of` names no type.
`data.type` or `data.edge` names what is wrong (`edge` is new on the code's data). If you pass
`withMapping` a graph you built yourself, list each type's key among its columns. A vertex type
`readJoinGraph` reads now carries `first`, the first of its global ids.
