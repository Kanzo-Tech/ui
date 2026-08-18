# A far view is a sample, not a summary

- **Status** live — 2026-08-18
- **Decided** A window holding at most `limit` vertices comes back whole; above it the source
  answers with one row in every `ceil(matched / limit)` of the corpus' Morton-ordered `dense_id`.
  There is no aggregated mode, no super-node, no `weights` and no zoom threshold — a sample is what
  a bounded source does when it cannot fit a window, at whatever zoom that happens.
- **Because** collapsing a corpus onto the groups of its own categorical column reproduced its mass
  field worse than a uniform box over its bounding rectangle, and the edge query that went with it
  joined the whole edge relation twice.
- **Reversed by** a corpus whose categorical column *does* describe the mass field — measured the
  same way, L1@8px against the uniform null, before it is believed — or a mark budget raised far
  enough that a precomputed density mipmap becomes the smaller payload rather than the larger one.
- **Held by** `packages/graph/src/duck-source.ts`, `strideSql`; `packages/graph/src/bounded.ts`,
  `Slice`; `packages/graph/src/index.test.ts`, "keeps the aggregate far view deleted, names and
  all"; `packages/graph/src/index.test.ts`, "samples a window it cannot fit rather than drawing the
  front of it"; `packages/graph/src/graph-model.test.ts`, "spends the ramp on the column the source
  ranks by, and knows no second one"; `packages/graph/src/duck-source.test.ts`, "takes the same
  sample in both reads, so the links land on points that came back".

## The metric, because without one this is taste

Zoomed all the way out a reader cannot perceive vertices: at five million the corpus falls into
960,000 pixels and 84.6% of its mass is in pixels holding eight or more. What is left perceptible is
*where the mass is*. So a far view means something when it reproduces the mass field at the
resolution it is looked at — measured as the normalised L1 of the mass field against the truth at
screen resolution, compared in blocks of eight pixels. Two anchors, because a bare L1 says nothing:
the **null** is a uniform field over the corpus' bounding box, which is what somebody who has only
the extent knows, and the **ceiling** is a density mipmap at screen resolution. Blocks of eight
rather than single pixels because at one pixel the metric measures *alignment* rather than likeness
— the mipmap, visually identical to the truth, scores 1.199 per pixel and 0.159 in blocks of eight.

**A summary is admissible when its L1@8px is at most half the null.** At five million that is 0.366.

The working, the six block scales and the window definitions are in
`.planning/FAR-VIEW-AND-EDGES.md`; the corpora are `docs/public/bench/200000`,
`docs/public/bench/1000000` and a rebuilt five-million tree, all three written by the same fossil
binary.

## What each candidate scored, and why the summary lost

L1@8px at 200k / 1M / 5M, lower better. `marks` is what it costs to draw.

| candidate | marks at 5M | L1@8px |
|---|---|---|
| **one point per `community` — what shipped** | 8 | **0.998 · 1.000 · 0.999** |
| one point per `cluster_id` | 15,310 | 0.932 · 0.989 · 0.985 |
| *uniform null* | — | *1.044 · 0.829 · 0.731* |
| `cluster_id` as the box of its members | 15,310 | 1.018 · 0.737 · 0.591 |
| random sample of 20,000 | 20,000 | 0.349 · 0.382 · 0.387 |
| **stride sample of 20,000** | 20,000 | **0.167 · 0.240 · 0.269** |
| *density mipmap, the ceiling* | *342,816* | *0.161 · 0.159 · 0.139* |

Read the first row against the third: **the far view that shipped was worse than drawing a uniform
grey box over the extent.** Not marginally, and not only at one size. No hierarchy column of this
corpus clears the admission bar by any margin, as a point or as an area — `community` is eight
groups of 625,000 and `cluster_id` has a median of one member, which is the output of this Louvain
rather than a property of hierarchies.

The stride clears it at 0.269 against 0.366, and beats a random sample of the same size by 1.44×.
That factor is exactly what the stratification buys: a corpus numbers `dense_id` along the Morton
curve, so every `s`-th id is spread over the space. The mipmap is 1.9× better again and costs 17×
the marks, which is a quality-against-bytes decision with both figures on the table rather than an
unknown.

## The other half of the argument is what it cost to draw

The aggregate branch emitted two queries. The points one was a `GROUP BY` and was free. The links
one joined the edge relation to the vertex relation twice and took `DISTINCT` over the result.
Timed natively, fourteen threads, duckdb 1.5.3:

| | points | links |
|---|---|---|
| 1M | 0.013 s | **390.5 s** |
| 5M | 0.035 s | **306.9 s** |

Not a curve — both are dominated by spilling — a query broken at any size from a million up. In
DuckDB-WASM, which is one worker behind a port where queries queue rather than overlap (measured;
`probeConnectionOverlap` in `docs/showcases/graph-bench/measure-bounded.ts`), that is not a slow far
view. It is the tab, including everything else the page wanted to ask.

The replacement, same corpus, same machine, native: the sampled points query is **42 ms** and its
links query is **50 ms**, returning 1,742 drawn edges at a stride of 50.

**And in the browser, which is the only place that settles it.** Driven through `openCorpus` against
`/bench/1000000` on 2026-08-18, tab in the foreground, DuckDB-WASM over the dev server:

| | before | after |
|---|---|---|
| the far view's points | 74.8 ms, and it is **eight marks** | 348–615 ms, 20,000 marks over the whole extent |
| the far view's links | **out of memory at 2.6 s** | 348 ms, 1,742 edges |
| the same window again | — | 6.9 ms |

The failure is worth quoting, because it is sharper than the hang that was expected: *"Out of Memory
Error: could not allocate block of size 256.0 KiB (3.1 GiB/3.1 GiB used) … Database is launched in
in-memory mode and no temporary directory is specified. Unused blocks cannot be offloaded to disk."*
Natively the same query spends 170–179 s of its 390 in spill; in a tab there is nowhere to spill to,
so it exhausts the WASM heap instead — and on three of four attempts it took the renderer down with
it and Chrome reloaded the page. A far view that shipped was not slow. It was a crash.

The mid-zoom half of the change is measured on the same page: a window over a quarter of the extent
matched 328,957 and returned 19,351, spanning x from −280 to 321,825 of a window running to 322,525.
The rows are drawn from the whole window. Before, that same window returned a Morton prefix.

## Where the threshold went

`lodThreshold` was 0.5 because that matched fossil's `viewport` verb, and that verb was deleted when
the camera became an address rather than a question — `decisions/a-tile-is-an-address-not-a-verb.md`.
It had been an unanchored constant ever since, and `Viewport.zoom` existed to be compared against it
and nothing else. Both are gone, and what decides is arithmetic nobody has to pick: a window is
sampled when it holds more than the caller's own `limit`.

That also fixes a defect that was never about the far view. A window over the limit used to come
back as its first `limit` rows in `dense_id` order — a **contiguous run of the Morton curve**, which
is a sub-region. A truncated window was drawn as one corner of itself, and `n` reporting the match
honestly did not help, because a corner and a thinned window look equally complete.

**It does not reopen the address record.** Its reversing evidence is *an aggregation level whose
tile set cannot be derived from what a reader already holds*, and the stride derives from nothing
but the request's own `limit` and a count the query was already computing. No request sits between
the camera moving and a URL being computable.

## What this does not settle

- **The mass field is not the only thing a far view could mean.** L1 over mass says nothing about
  whether a reader can *identify* which region they are looking at — that is labelling — nor whether
  colour by category survives the summary. A summary with a low L1 and no categorical column would
  be useless for a different reason.
- **One family of corpora.** Hyperbolic layout, one vertex type, one relation. Nothing here was
  measured against a knowledge graph, where the multi-type findings already break things a
  single-type corpus does not.
- **Five million was not measured in a browser.** The far view there addresses over a thousand tiles
  per side, and `next dev` answered the probe burst with `TypeError: Failed to fetch` before the
  first query. The five-million figures above are native, and what a tab does with that many
  addresses is the pyramid's problem rather than this record's.
- **The stride is only *spatially* stratified where the ids are Morton-ordered**, which is a
  property of the corpus rather than of this package. `memorySource` strides over whatever order the
  host built its arrays in and promises nothing about the space; it is still never worse than the
  prefix it replaces, because a prefix of an unknown order is an arbitrary *contiguous* sample.
- **A precomputed pyramid is still the better answer and is writer work.** A level per stride, each
  its own relation with its own dense numbering, tiled identically — about 31% more vertex bytes at
  five million, and it turns the far view from reading every tile into reading one level's worth.
  This is the reader-side half that needed no line in the writer.
