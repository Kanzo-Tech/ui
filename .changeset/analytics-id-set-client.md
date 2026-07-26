---
"@kanzo-tech/ui": minor
---

**`IdSetClient`: the crossfilter adapter for a view whose positions are not in the database.**

A Plot brush publishes `weight BETWEEN 30 AND 50` because Plot's `x` **is** a column. A GPU
simulation's `x` is not: the position exists nowhere in the relation, so no predicate over columns
can describe the loop a user drew around it. Such a view can only enumerate what it hit.

That shape is the same every time — fade by the surviving ids, publish a points clause, and decline
the crossfilter's self-exemption so the fade reads as the brush — and it is what a canvas, a map or
any imperative widget needs to become a peer of the plots rather than a readout drifting beside
them.

```ts
import { IdSetClient } from "@kanzo-tech/ui/analytics";

const client = new IdSetClient({
  table: "nodes",
  idField: "id",
  filterBy: crossfilter,
  as: crossfilter,
  onSurvivors: (ids) => view.fadeAllBut(ids),
});
coordinator.connect(client);
view.onLasso((hit) => client.publish(hit.length ? hit : null));
```

`publish(null)` retracts rather than publishing an empty set, because an empty clause has a null
predicate and the resolver drops it.

It adds no dependency. This was written against `@cosmos.gl/graph` and named after it, but it
imports nothing from it — which is why it sits beside `MosaicClient` on the analytics subpath
rather than behind an optional WebGL peer of its own. The cost of the approach is unchanged and
worth stating: the selection travels as an `IN` list, so its size is the ceiling.
