---
"@kanzo-tech/graph": minor
---

**`openCorpus` stopped knowing how fossil names a file, and `@kanzo-tech/graph/duckdb` gained a
peer for it.**

Opening a corpus used to mean this package deriving every URL from conventions written down on this
side: a line-scanning reader for `graph.graph.yml`, a `chunk{k}.parquet` spelling, a
`by_source/tile{k}.parquet` spelling, a `HEAD`-probing search for how many tiles there were, and a
scan of the index's `vertices:`/`edges:` lists to know which manifests to ask for. Four of the five
were wrong by the time they were deleted — fossil writes `container: rowgroups`, one `tiles.parquet`
whose row groups are the tiles, and `vertex_count` had been in the manifest the whole time the search
was probing for it. A reader built on a stale convention does not fail: it reads a fraction of the
corpus and says nothing.

They are replaced by `@fossil-lang/corpus`'s `open`, which is `fossil_graph::plan` compiled to
wasm32 — the arithmetic fossil's own native reader runs, rather than a second implementation of it
that agrees until it does not.

**Breaking: `./duckdb` now declares `@fossil-lang/corpus` as an optional peer, and you install it if
you open a corpus.**

```sh
pnpm add @fossil-lang/corpus
```

Nothing on the root barrel is affected, and neither are the rendering hooks. There is no residual
cost left to name: `duckBoundedSource` shared this subpath and did not need the peer, so a host on it
either installed the reader or the entry had to be split — and that source is deleted in the same
release. Everything on `./duckdb` wants fossil now, so the subpath and the peer are one decision.
The declared range is `*` until fossil publishes, and becomes a real one then.

**Two options on `OpenCorpusOptions`, for the two things only a host can answer.**

`wasmUrl` is where `fossil_graph_wasm_bg.wasm` is, because only your bundler knows how an asset
resolves — `?url` under Vite, an asset import under Next, a `Response` over the bytes in Node. The
boot is memoised, so a second corpus in the same session need not repeat it.

`readText` is how a manifest is read, and it defaults to `fetch`. Give it when your corpus sits
behind a signature:

```ts
const { source, nodes, edges } = await openCorpus({
  coordinator,
  dest: "https://blobs.example/corpus/archive",
  readText: async (url) => (await fetch(await sign(url))).text(),
  wasmUrl,
});
```

**Lending the reader is the point, rather than composing the addresses yourself.** `open` composes
every address and lends your reader to each one, so you sign the index and the per-type manifests the
index names without having to know which files those are — which is the five conventions above,
arriving back one caller out. It reads manifests and nothing else; the payload is read by your
coordinator's connector, which was always yours.
