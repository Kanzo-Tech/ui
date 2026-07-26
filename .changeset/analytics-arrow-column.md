---
"@kanzo-tech/ui": minor
---

**`column` and `numbers`: reading a Mosaic answer, on the `/analytics` subpath.**

`MosaicClient` is a small protocol — declare a query, publish a clause — and the barrel already
exports everything needed for both halves. It did not export what happens in between. `queryResult`
receives an Arrow table, and Arrow only offers a typed column when the type allows one: `getChild`
returns an array for an integer `id` and nothing usable for a dictionary-encoded `label`.

So every client writes `data as { getChild(name: string): { toArray(): ArrayLike<unknown> } }`,
which is a cast asserting the shape rather than checking it — correct until the first query that
selects a string, then a crash. It appeared four times in this repo before anyone wrote the
function.

```ts
import { column, numbers } from "@kanzo-tech/ui/analytics";

queryResult(data) {
  this.greyOutAllBut(column(data, "id"));
  return this;
}
```

`column` takes the typed path when Arrow offers one and iterates rows when it does not. `numbers`
is the same with a coercion, because some integer widths arrive as `BigInt`. Neither adds a
dependency: they are plain functions over whatever the coordinator returned.
