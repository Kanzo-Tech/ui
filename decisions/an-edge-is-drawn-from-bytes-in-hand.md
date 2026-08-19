# An edge is drawn from bytes in hand

- **Status** live — 2026-08-19
- **Decided** An edge is drawn when one end is a mark and **both ends have a position among the
  bytes this window already fetched** — the far end is appended past `marks` as an *anchor*, at its
  own coordinates, never painted. And an edge shorter than three screen pixels is not sent at all.
- **Because** the far end of an edge leaving a window was never a missing fact, only a missing
  position, and the tiles a rectangle touches already hold most of them; while the majority of the
  rows that *were* sent draw a segment shorter than the dots at its two ends.
- **Reversed by** a corpus whose tiles are laid out so that the vertices just outside a rectangle
  are not in the tiles it reads — measured the same way, as the share of a window's lost edges the
  read tiles can answer — or a canvas at a resolution where the median drawn edge clears three
  pixels, which is the same thing as saying the window holds few enough vertices to be legible.
- **Held by** `packages/graph/src/duck-source.ts`, `anchorCte`; `packages/graph/src/duck-source.ts`,
  `longEnough`; `packages/graph/src/bounded.ts`, `marks`; `packages/graph/src/bounded.ts`,
  `minLinkPixels`; `packages/graph/src/memory-source.ts`, `anchorOf`;
  `packages/graph/src/graph-model.test.ts`, "draws the far end of an edge that leaves the window";
  `packages/graph/src/graph-model.test.ts`, "gives an anchor no radius and no residency";
  `packages/graph/src/graph-model.test.ts`, "does not send an edge shorter than three screen
  pixels"; `packages/graph/src/duck-source.test.ts`, "builds no far-end branch for a source that
  holds no bytes"; `packages/graph/src/duck-source.test.ts`, "discards nothing when the caller said
  nothing about resolution".

## Half the layer was fog, and two thirds of it was under a pixel

Measured over five windows of twenty thousand vertices per corpus, native duckdb 1.5.3, windows
defined by Chebyshev square around centres ranked by `subject` — the definition
`docs/showcases/graph-bench/corpus/measure-retention.mjs` uses, so the sets are the same ones
`.planning/FAR-VIEW-AND-EDGES.md` measured. The drawn-edge count of its window 2 reproduces exactly
at both sizes, which is how two independent programs were checked against each other.

| edge length, in pixels | p50 | under 1 px | under 2 px |
|---|---|---|---|
| 200k | 1.60 | 35.2% | 56.2% |
| 1M | 1.47 | 38.5% | 57.4% |
| 5M | **0.52** | **64.6%** | 72.0% |

An edge that short is a dot on top of two dots the point layer has already drawn. Discarding
everything under three pixels leaves **99.9–100% of the inked pixels identical**, which is the number
that makes this free rather than a trade.

**It is a row discard and not `linkVisibilityDistanceRange`.** That uniform exists, dims a short
link, and dims it *after* the row has been joined, returned, uploaded and rasterised. Same picture,
all of the work.

**And it is not the raster family either.** `@uwdata/mosaic-sql` ships `lineDensity`, over Moritz and
Fisher's `DenseLineMark`, and it was measured before it was refused: on this window it costs 87–115×
the join it is built on and returns **4.1× the rows it replaces**, because the join is still
compulsory — you have to have the segment before you can bin it — and the raster is added on top.
The crossover, where a raster becomes the smaller payload, is around 470,000 edges; a slice returns
about 120,000. Four times below.

## The far end was addressable, and the tile answers it for nothing

Between a fifth and a third of the edges incident to a window are dropped because one end is outside
it: 19.31% / 31.94% / 28.92% at 200k / 1M / 5M, and 7,930 of 20,000 vertices carry at least one stub
at five million.

The obvious repair is a second addressing pass — the far vertex `d` lives in tile `d >> 12` — and it
was **measured and refused**. Over the same five windows at a million, the far ends of one window
fall in **172–242 distinct vertex tiles** against the **11–16** the window itself reads, of which
158–228 are not held. On a corpus with 245 tiles that is reading the whole vertex relation, and
requests are the term that follows N.

What was measured instead is that a tile is much wider than the rows a rectangle keeps from it: 4,096
rows of a Morton-ordered relation, whose bounding box overlaps the window generously. So relaxing the
join from *inside the rectangle* to *inside the tiles that were read* costs no request, no query and
no byte:

| five windows, summed | today | drawn from bytes in hand |
|---|---|---|
| 1M — of 906,337 incident | 616,885 (68.1%) | **781,562 (86.2%)** |
| 5M — of 775,876 incident | 551,496 (71.1%) | **654,195 (84.3%)** |

**45.8% to 56.9% of everything the reader was losing, recovered for free.** The remainder needs
`by_target` tiled, which is the corpus's half.

## Why the anchor is the vertex and not a point on the border

Clipping the segment to the viewport was the other candidate and the measurement rules it out. Over
*all* the far ends a window loses, the median sits 1.64 semi-widths out and the worst **47.1** — and
a reader cannot tell a stub ending 1.1 window-widths away from one ending 47. A clipped stub carries
the right direction and lies about the distance.

The far ends a held tile can answer are a different distribution, and it is the near one:

| 1M, per window | p50 | p90 | worst | within 2 semi-widths |
|---|---|---|---|---|
| anchors, from held tiles | 1.11–1.85 | 1.29–2.60 | **2.21–6.74** | 63.7–100% |
| every reachable far end | 1.58–3.07 | — | 7.09–16.91 | — |

**So the free answer and the honest one are the same answer, and there was no trade to make.** The
tile boundary is itself a distance filter: it selects the near far-ends and leaves the long tail
undrawn — undrawn because its bytes are not here, rather than because anybody decided it was too far
to be interesting. Drawing the vertex where it is cannot lie, and it is also the cheaper of the two:
a clipped stub is one point *per edge*, an anchor is one point per far *vertex*. Measured, the
anchors of a window are 2,075–24,783 points at a million and 2,599–7,657 at five million, against
20,000 marks.

An anchor is in the buffers and is not a mark, and three things agree about it: `buffers` gives it
radius zero, `residentOf` stops at `marks`, and no category or ramp value is assigned. Any one of the
three missing would work by accident — an anchor is outside the rectangle and therefore off screen —
right up until a **sampled** window, where a vertex the stride passed over is inside the rectangle
and would paint a mark the answer did not return.

## Only an addressed source has bytes in hand, and that is a parameter rather than a flag

`openCorpus` reads `read_parquet([the tiles this rectangle touches])`, so the relation it queries
*is* what it holds, and it passes that same relation as `held`. `duckBoundedSource` reads a named
relation: nothing there is "already fetched", `held` would be the whole node table, and the join
would scan the corpus twice per camera move — the unbounded pattern wearing a bounded interface. It
passes `undefined`, and its links query keeps both ends in the sample.

## What this does not settle

- **None of it was driven through a browser.** The SQL this emits was run against duckdb 1.5.3 over
  the real tiles of `docs/public/bench/1000000` — a window of 6,431 marks went from 39,072 links to
  35,611 with 5,248 anchors and 17,093 stubs, 19 ms to 25 ms — which proves the statements are valid
  and do what they say. It does not prove what a tab does with them, and DuckDB-WASM is one thread
  where this is fourteen.
- **The other half of the hole is still open.** An edge whose *source* is outside the window lives in
  a `by_source` tile the window does not read; some of them fall into a read tile and are recovered
  here by the same relaxation, and the rest need `by_target` tiled. These corpora carry
  `by_target.parquet` flat.
- **Nothing publishes how many edges are still missing.** `.planning/FAR-VIEW-AND-EDGES.md` asks for
  it and it is a `count`; an incomplete edge layer still looks exactly like a complete one, which is
  the failure `matched` fixed for the vertices.
- **The layer is still fog above about 3,500 edges per megapixel**, which is roughly 600 vertices on
  screen against a cap of 20,000. This makes the fog cheaper and more correct; it does not make it a
  picture of edges. That is a level-of-detail question and it is a different step.
- **One family of corpora.** Hyperbolic layout, one vertex type, one relation. A multi-type corpus
  draws **0.00%** of its cross-type edges inside a window at any size, so nothing here applies to one:
  there the answer is a neighbourhood, not a rectangle.
- **The anchor reach is a property of this tiling.** 4,096 rows per tile over a Morton curve is what
  makes a tile's box wide enough to hold the near far-ends. A re-tiling changes the recovery share,
  and a re-*layout* invalidates every figure above.
