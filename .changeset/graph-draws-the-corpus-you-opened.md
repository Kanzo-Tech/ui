---
"@kanzo-tech/graph": minor
---

**Breaking: `openCorpus` takes the corpus you opened with fossil, and the page's engine.**

It no longer opens one itself. `dest`, `readText` and `wasm` are gone; pass the `Corpus` that
`open` from `@fossil-lang/corpus` answered and `engine()` from `@kanzo-tech/mosaic`. The peer range
on `@fossil-lang/corpus` is now `^0.3.0-alpha.10`.

```diff
+ import { open } from "@fossil-lang/corpus";
+ import { engine } from "@kanzo-tech/mosaic";
  import { openCorpus } from "@kanzo-tech/graph/duckdb";

- const { source, nodes, edges } = await openCorpus({ coordinator, dest, readText });
+ const e = await engine();
+ const corpus = await open(url, { query: e.query });
+ const { source, nodes, edges } = await openCorpus({ corpus, engine: e });
```

A host whose files are signed opens the corpus under a name and hands over the same `corpus`:

```ts
const corpus = await open(`jobs/${id}`, { engine: e, host: { sign }, sql: "allowed" });
const { source } = await openCorpus({ corpus, engine: e });
// on unmount
await corpus.close();
```

Opening and closing are yours; `openCorpus` never opens a second copy, so the host that already
queries a corpus stops opening it again just to draw it.

**Breaking: `nodes` and `edges[].view` are fossil's relations, not views of ours.** The persistent
`corpus_<Type>` and `corpus_<src>_<edge>_<dst>` views are no longer created. `nodes` and each
`view` are now the qualified name fossil's verbs query, e.g. `"jobs/1"."Person"`. That is already
quoted SQL: interpolate it into SQL text as is, and hand it to Mosaic's builder as a node, because
`Query.from(string)` quotes a string again as one identifier:

```diff
- Query.from(nodes)
+ Query.from(verbatim(nodes)) // verbatim from @uwdata/mosaic-sql
```

Replace any `corpus_…` name you wrote by hand with `nodes` or the matching `edges[].view`. The
names go away when the corpus is closed.

**Tiles are no longer cached as buffers**, and the `HEAD` request sent for every tile address is
gone with the cache. Tiles are read by the names the corpus gives them, which are registered files
on a signed corpus rather than URLs.
