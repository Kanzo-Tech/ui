---
"@kanzo-tech/graph": minor
---

**Breaking: `@kanzo-tech/graph` ships one source, and `@kanzo-tech/graph` on its own no longer
draws.**

`memorySource` and `MemoryGraph` are gone from the root barrel. `duckBoundedSource` and
`DuckSourceOptions` are gone from `./duckdb`. What is left is `openCorpus`, which takes where a
corpus is and gives back the source for the canvas and the relations registered under their own
names.

```diff
-import { memorySource } from "@kanzo-tech/graph";
-const source = memorySource({ vertices, positions, links });
+import { openCorpus } from "@kanzo-tech/graph/duckdb";
+const { source, nodes, edges } = await openCorpus({ coordinator, dest, wasmUrl });
```

**So the root barrel is a rendering surface and nothing else** — the hooks, the look, identity, the
buffers a slice implies. Install it with only `@cosmos.gl/graph` and it imports, renders a canvas and
asks nobody anything; a picture costs `@kanzo-tech/graph/duckdb` and its two optional peers. That is
a real change to what the package promises: `scripts/smoke-install.mjs` used to assert that the root
barrel *drew* with no database installed, and now asserts only that it *imports*, because there is
nothing left on it to draw with.

**The argument the two deletions share.** A corpus declares its own column names, its own type index
and its own tile geometry, in a manifest. A source that *accepts* those is this side writing down
what the other side owns — the same defect `openCorpus` was built to end one layer up, where a
line-scanning YAML reader and four filename conventions had gone stale without failing.
`duckBoundedSource` was the general case of exactly that, and `memorySource` was the same bargain in
JavaScript: a second implementation of sampling, of the far-end anchor and of the link-length
discard, running nowhere but its own tests, kept so that the smallest example could avoid a database.

**What you lose if you were the arrays-in-hand host.** A real loss, and there is no shim: rule 1 of
this repository forbids one. `BoundedSource` is exported and is **one method** — answer what is in
this rectangle, at this resolution, in at most this many marks — so the replacement is a source of
your own, against a contract that is documented for that purpose. `shouldSlice` stays for the same
reason: a graph that fits is asked once and never again.

**`explore`, `ExploringSource` and `ExploreRequest` are deleted too**, and this one is a narrowing
rather than a simplification. A rectangle cannot express "two hops from this node", so a contract
that speaks only rectangles imposes the metaphor of a map on a network — which is why the
neighbourhood was added in the first place, and why `/docs/design/graph` names it as the seam
fossil's `expand` comes in through. It goes because `memorySource` was its only implementation and
because the obvious replacement failed on measurement, not on taste: a recursive CTE over 6.9M edges
did not return in 45 seconds and took the tab with it. The shape that works is addressed — the
`by_source` and `by_target` tiles a seed's `dense_id` falls in, two 74 kB reads the tile cache
already serves — and it needs `by_target` tiled the way `by_source` is, which is the corpus' side of
the seam. `packages/graph/src/index.test.ts` carries both sentences so the next person does not have
to rediscover them.

`GraphApi.explore(seeds, depth)` goes with it. Nothing called it.
