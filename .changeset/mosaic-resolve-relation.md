---
"@kanzo-tech/mosaic": minor
---

`resolveRelation(graph, { root, types, under })` computes the relation a question needs: the shortest path from the type it counts that covers the types its fields are on and reaches the page's clauses. It answers the one relation, the equally short ones when the choice is the reader's (`ambiguous`), or what no relation within reach covers (`unreachable`) — so a filter an answer cannot reach is known before anything runs.
