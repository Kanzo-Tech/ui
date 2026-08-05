# Graph scale

Written by hand, from runs of `docs/showcases/graph-bench/run-bench.mjs`. The runner does **not**
own this file: it replaces only the block at the bottom, between the `run:start` and `run:end`
markers, and refuses to write at all if those are missing. Everything else — the dated layers, the
levers that turned out not to exist, the analysis — is folded in by a reader afterwards, which is
what makes it a record rather than a printout.

- **Renderer:** ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)
- **Measured:** 2026-07-31
- **Shape:** hyperbolic random graph, mean degree 14, seeded

## Layer 1 — the engine

`Per step` is the mean of batched `graph.step()` calls flushed by a `getPointPositions()`
readback, so it is real GPU work. `Step ceiling` is what that cost implies on its own.
`Frames` counts cosmos.gl's own `onSimulationTick` over a wall-clock window — not our waits:
counting `requestAnimationFrame` published a flat 60 fps at every size, which is the monitor's
number, not the graph's.

**Read `Step ceiling`, not `Frames`, to judge whether a layout keeps up.** The two disagree on
purpose. WebGL commands queue without the CPU waiting, so the loop keeps presenting frames at
vsync while the GPU falls behind — the picture is smooth and stale at once. Only the readback
in `Per step` forces the queue to drain, which is why it is the honest one. Where they converge
(1M) the queue has stopped absorbing the difference.

| Nodes | Links | Generate | Upload | Per step | Step ceiling | Frames |
|---|---|---|---|---|---|---|
| 2k | 12.5k | 5 ms | 60 ms | 1.52 ms | 656 fps | 120 fps |
| 10k | 69.3k | 15 ms | 79 ms | 4.35 ms | 230 fps | 120 fps |
| 50k | 331.6k | 65 ms | 192 ms | 10.03 ms | 100 fps | 80 fps |
| 200k | 1.4M | 454 ms | 751 ms | 61.00 ms | 16 fps | 61 fps |

## Layer 2 — our pipeline

The same graphs arriving the way a real one does. `load()` and `buffers()` are imported from
`workspace/graph-model.ts`, not reimplemented — a benchmark that measures a copy measures the
copy. **Ours** is the sum of everything on the interactive path; ingest is timed but excluded,
because this fixture reaches DuckDB as CSV text where a real corpus arrives as Parquet.

| Nodes | Links | `load()` | ↳ read | ↳ rows | ↳ links | ↳ rank | `buffers()` | Upload | Select | **Ours** |
|---|---|---|---|---|---|---|---|---|---|---|
| 2k | 12.5k | 23 ms | _19_ | _1_ | _3_ | _0_ | 1 ms | 64 ms | 0 ms | **104 ms** |
| 10k | 69.3k | 30 ms | _19_ | _2_ | _8_ | _1_ | 2 ms | 79 ms | 1 ms | **120 ms** |
| 50k | 331.6k | 99 ms | _50_ | _6_ | _37_ | _6_ | 8 ms | 198 ms | 2 ms | **316 ms** |
| 200k | 1.4M | 386 ms | _192_ | _21_ | _150_ | _24_ | 33 ms | 788 ms | 7 ms | **1225 ms** |

## Layer 3 — bounded

The other architecture, not a variant of the one above: the camera asks for a rectangle and the
answer is capped, so the working set is the window rather than the corpus. `First paint` should
stop scaling with N. `Pan` is the cost that did not exist before — unbounded moves the camera on
the GPU for free, this asks the database each time — and it is the number that decides whether
the trade is worth making.

| Nodes | `total()` | First slice | Upload | **First paint** | Pan | Shown / matched |
|---|---|---|---|---|---|---|
| 2k | 11 ms | 33 ms | 25 ms | **69 ms** | 10 ms | 2k / 2k |
| 10k | 8 ms | 20 ms | 30 ms | **57 ms** | 10 ms | 10k / 10k |
| 50k | 8 ms | 33 ms | 31 ms | **72 ms** | 19 ms | 20k / 50k |
| 200k | 9 ms | 67 ms | 29 ms | **105 ms** | 30 ms | 20k / 200k |

Every row is checked against the graph it was supposed to load before it is timed. That check
is not ceremony: it caught the whole table being fiction once, when Mosaic served the second
size from the first size's cached Arrow and every row after 2k described a 2,000-node graph at
flattering speed.

## Layer 4 — bounded, over a compiled corpus

The same path with the fixture swapped. Layer 3 builds its graph in the tab, which is why it
stops at 200,000: a million is 8.6 s of main-thread JavaScript before DuckDB sees a byte. Here
the corpus is a GraphAr tree fossil wrote once — two DuckDB **views** over Parquet fetched by
range request, never a `CREATE TABLE AS`, so the bytes stay on the server and the working set
stays the window. Measured cold, 2026-08-01, M4 Pro.

| Nodes | Links | Attach | `total()` | First slice | Upload | **First paint** | Pan | Redraw | Shown / matched |
|---|---|---|---|---|---|---|---|---|---|
| 2k | 12.5k | 130 ms | 14 ms | 61 ms | 25 ms | **100 ms** | 21 ms | 0.47 ms | 2k / 2k |
| 10k | 69k | 36 ms | 18 ms | 35 ms | 30 ms | **86 ms** | 24 ms | 2.98 ms | 10k / 10k |
| 50k | 332k | 37 ms | 17 ms | 43 ms | 30 ms | **90 ms** | 33 ms | 2.83 ms | 20k / 50k |
| 200k | 1.37M | 37 ms | 16 ms | 74 ms | 41 ms | **132 ms** | 48 ms | 1.41 ms | 20k / 200k |
| 1M | 6.90M | 70 ms | 17 ms | 219 ms | 24 ms | **253 ms** | 95 ms | 0.57 ms | 20k / 1M |

**Five hundred times the corpus for 2.6× the first paint**, against 1,225 ms to hold 200,000.
`matched` is the whole corpus at every size and `shown` never exceeds the limit, so the window
is the work. Writing the corpus costs fossil 10.6 s at a million and it is paid once, offline.

**A repeat sweep was measuring the cache.** Run twice on one page it reported a flat 60–71 ms at
every size including a million: Mosaic caches by SQL text and a second sweep asks the identical
questions. Each measurement now clears that cache, after which the repeat reproduces the cold
shape (257 ms at a million against 262). Third time this benchmark has measured its own
scaffolding — see the frame counter in layer 1 and the cached Arrow in layer 3. **Disbelieve a
flat line until it survives a cold start.**

**The first remote read of the page costs ~21 s, once.** DuckDB-WASM fetches its httpfs
extension on first use and every read afterwards is in the tens of milliseconds. It is a
first-use cost, not a corpus cost, and preloading the extension at boot would remove it.

### The renderer is not the limit, and the frame rate is two numbers

`Redraw` is the cost of drawing the slice already on screen, timed as layer 1 times a step — a
batch flushed by one `getPointPositions()` readback, never by counting `requestAnimationFrame`,
which reports the monitor's schedule whether or not anything was drawn.

**0.5–3 ms at every size, which is a ceiling of 300–2,000 fps.** It does not follow N and cannot:
the slice never exceeds the limit. What it does follow is the *link* count in the slice, which is
why a million is the cheapest row of all — barely any of its edges survive the window (see below).

So "how many frames per second" has two answers and only one of them is interesting:

| Nodes | Redraw ceiling | Pan | **Updates per second** |
|---|---|---|---|
| 2k | ~2,100 fps | 21 ms | **48** |
| 10k | 336 fps | 24 ms | **41** |
| 50k | 354 fps | 33 ms | **31** |
| 200k | 708 fps | 48 ms | **21** |
| 1M | 1,744 fps | 95 ms | **10.5** |

The canvas never waits — `useBoundedGraph` keeps the instance alive and pushes geometry only when
a slice lands, so the *picture* moves at the display rate throughout. What drops to ten per second
at a million is how often it becomes **correct**. That is the number to improve, and it is a query
cost, not a rendering one.

**The obvious lever is not the lever, twice.** Rewriting the million-node vertex file at 8,192-row
groups cuts rows scanned for a window from 491,520 to 49,152 — and the slice went 219 → 229/244 ms
and the pan 95 → 109/112 ms over two runs. Slightly worse, never better. The excuse offered at the
time was that 19 MB is too small for pruning to pay, so it was **retried at five million**, on a
97 MB file: 611 row groups took the slice from 974 ms to 1,072 ms and the pan from 331 ms to 420 ms.
Twice measured, twice worse, and the second time at the size the first excuse pointed at. Per-group
metadata and more, smaller reads cost more than the pruning saves. Native DuckDB runs the same two
queries locally in 6 ms and 10 ms, so what is left is WASM. `--row-group` stays on
`build-corpus.mjs` so nobody re-derives this a third time.

The preview canvas carries the live rate in its corner, counted the same way — `onSimulationTick`,
never `requestAnimationFrame`. At 199,800 nodes it reads **14–16 fps**, which is layer 1's 61 ms
step arrived at by a completely different mechanism: a rolling counter on a canvas somebody is
watching, against a batch of `graph.step()` calls flushed by a readback. Two independent routes to
the same number is the cross-check that says neither is measuring itself.

It also refuses to invent one. A backgrounded tab does not tick slowly, it does not tick, so the
badge says `tab hidden · frames stop` rather than dividing zero by half a second and publishing a
confident 0 fps. When the layout stops moving it says `layout settled`, because a settled graph
reporting 0 fps reads as a stall.

### Five million, and where the claim actually breaks

The headline of this page is *first paint follows the window rather than the corpus*. Measured to a
million it looks true. At five million it is false, and the shape of the failure is the useful part.

| Nodes | Links | `total()` | First slice | Upload | **First paint** | Pan | Updates/s | Redraw |
|---|---|---|---|---|---|---|---|---|
| 200k | 1.37M | 7 ms | 66 ms | 24 ms | **97 ms** | 41 ms | 24.2 | 836 fps |
| 1M | 6.90M | 7 ms | 210 ms | 23 ms | **240 ms** | 93 ms | 10.7 | 1,807 fps |
| 5M | 34.97M | 9 ms | 974 ms | 23 ms | **1,006 ms** | 331 ms | 3.0 | 2,113 fps |

Five times the corpus costs **4.6× the slice and 3.6× the pan**. That is linear, not flat. And
1,006 ms of first paint at five million is no longer an improvement on the 1,225 ms that holding
*two hundred thousand* used to cost — the bounded path wins by 25× on corpus size at the same
latency, which is a real result, but it is not the constant it was advertised as.

**What is flat is worth naming precisely, because it is half the architecture:** `total()` stays at
7–9 ms because it is Parquet metadata; the upload stays at 23 ms because the slice is capped at
20,000 marks; the redraw ceiling stays in the thousands of frames per second. So the window really
does bound everything that is *drawn* and *transferred*. What it does not bound is what is
**scanned** — the bbox predicate and the edge join are both O(N), and no amount of limit on the
answer changes the cost of finding it.

That is the honest statement of the architecture: **bounded rendering, unbounded querying.** Getting
the second half sublinear needs a real index, and the two attempts to fake one with Parquet
row-group statistics both made it slower.

### DuckDB gets one core, and cross-origin isolation does not change that

Every row above was produced with **`threads = 1`** on a machine with fourteen. The samples now
carry the number, because a page reporting "220 ms at a million" without saying which of those two
it was is not reproducible.

The obvious cause is the obvious fix and it is neither. `selectBundle` takes the threaded `coi`
build only when the document is cross-origin isolated, and by default it is not — no
`SharedArrayBuffer`, no threads. Serving the route with `Cross-Origin-Opener-Policy: same-origin`
and `Cross-Origin-Embedder-Policy: credentialless` (`credentialless`, because DuckDB's bundles come
from jsDelivr by `importScripts` and its httpfs extension from `extensions.duckdb.org` — both
no-cors loads that `require-corp` blocks) does make `crossOriginIsolated` true and
`SharedArrayBuffer` exist. **`threads` stays 1 and nothing gets faster.**

Controlled on the same page minutes apart, one variable:

| Nodes | Pan, isolated | Pan, not | Slice, isolated | Slice, not |
|---|---|---|---|---|
| 2k | 9 ms | 9 ms | 34 ms | 36 ms |
| 10k | 9 ms | 9 ms | 13 ms | 20 ms |
| 50k | 17 ms | 17 ms | 21 ms | 30 ms |
| 200k | 26 ms | 26 ms | 63 ms | 59 ms |

The pan is identical to the millisecond at every size. So the headers are **not** in
`next.config.ts`: they constrain how every document on the route may embed anything cross-origin,
and they bought nothing. Getting real threads would mean going further into Mosaic's connector,
which selects the bundle itself and passes no config — worth knowing before anyone assumes a header
is all that stands between this and four cores.

### Where the slice actually goes, at a million

Timed in the browser on the live views, warm, each query on its own — first through a private
`db.connect()`, then through the coordinator so the difference is Arrow IPC and decoding:

| Query | Raw connection | Via coordinator |
|---|---|---|
| points (bbox, numbered, limit 20k) | 25–29 ms | 32–43 ms |
| links (the CTE joined twice against 6.9M edges) | 33–34 ms | 34–37 ms |
| matched (`count(*)` over the whole predicate) | 9–10 ms | 10 ms |

**Arrow IPC and decoding cost about 10 ms**, not the transport tax it would be easy to assume.
The three sum to ~75 ms, which is the 95 ms pan almost exactly — and the 217 ms *first* slice is
that plus the cold HTTP fetch of the 19 MB vertex file's column chunks, which every later pan then
reuses. That is why first paint is 2.3× a pan at the same size and why the gap does not appear at
2,000.

**The largest single win is concurrency, not format.** `detail()` issues its three queries with
`Promise.all`, but Mosaic funnels them through one DuckDB connection and fulfils results in strict
FIFO order, so they serialise: the sum is 75 ms where the slowest is 35 ms. Running them on
separate connections would put the pan near 40 ms — from 10.5 updates a second to about 25 — which
is more than any file-layout change on this list offers.

**What is left to try, in the order the measurements support:** issue the slice's three queries
concurrently rather than down one connection (75 ms → ~35 ms); Morton-order the edge file, which is
sorted by `src_dense` and so scans all 6.9M rows with nothing to prune, worth at most the 35 ms that
query costs; skip `matched` while the camera is moving, worth 10 ms; and a tile cache, which would
make panning *back* free — the only item here that no amount of query tuning can substitute for.

## What the corpus does *not* yet give

Two facts about the written positions, both measured, both about usefulness rather than speed.

**A window showed the nodes but not the graph — fixed, and here is the number.** WCC on a connected
graph returns a single component, so the whole million landed in one phyllotaxis spiral whose radius
(12·√n ≈ 12,000) swallowed the 100-unit cluster grid entirely. `enrich_layout` now partitions by
`community_hierarchy`. Measured by `corpus/measure-retention.mjs`, five windows each holding 3,500
nodes:

| | kept / incident | retention | null | ball |
|---|---|---|---|---|
| 1M, WCC | 589 / 225,448 | **0.26%** | 0.17% | 4.55% |
| 1M, communities | 78,094 / 137,024 | **56.99%** | 0.21% | 4.55% |
| 5M, communities | 91,119 / 143,147 | **63.65%** | 0.04% | 1.71% |

Getting there took one more finding. The first wiring used a single partition for
both jobs and reached 13.63%; splitting them reached 57%. `cluster_id` is read by
`viewport`'s aggregate mode, one super-node per cluster under a `LIMIT`, so it has to
stay coarse — but the *placement* wants the opposite, communities small enough that
several fit in one window. Forcing one partition to be both put the layout at the top
of the hierarchy, where every community is a root and the ordering that puts siblings
side by side has nothing left to order.

The window is defined by rank — the smallest square centred on a node holding exactly *k* of them —
because a fixed rectangle catches wildly different node counts in two layouts and would report a
difference that is mostly the node count.

Three corrections come with it. **The old figure was scored against a null twice too large**: for a
random window `kept ≈ E·(k/N)²` against `incident ≈ 2E·k/N`, so chance is `(k/N)/2` and not `k/N` —
the honest reading of the old layout is 1.5× chance, not four times. **The "ball" is a reference and
not a ceiling**: a breadth-first ball of *k* nodes is what topology alone gets you with no layout in
the way, and the community layout beats it threefold, because a ball spends most of its budget on a
frontier whose edges all point outwards. And **`cluster_layout` had a defect the old partition hid**
— a cluster of *n* packs into a disc of radius 12·√n, past the 100-unit pitch at 70 vertices, so
real communities overlapped their neighbours; a single giant component has no neighbour to overlap.
The pitch is now measured from the largest cluster.

**Morton order prunes, but the row group is too coarse a unit.** For that same window:

| Row-group size | Groups | Read | Rows read for 3,533 |
|---|---|---|---|
| 122,880 (the default fossil writes) | 9 | 4 | 491,520 — **139×** |
| 32,768 | 31 | 6 | 196,608 — 56× |
| 8,192 | 123 | 6 | 49,152 — **14×** |

The number of groups a window touches stays at 4–6 however many there are, which is the Morton
locality working; the over-read is set entirely by how big each group is. Over a network that
factor is bytes fetched. `Node.vertex.yml` already declares `chunk_size: 1024` while the Parquet
is written at DuckDB's default — the manifest promises a chunking the file does not have.

**And the chunking it promised would not have pruned, because `dense_id` was numbered by IRI.**
GraphAr defines chunk *i* as the `dense_id` range `[i·size, (i+1)·size)`, so a chunk is a spatial
tile only if `dense_id` ascends with position — and the layout used to reorder the *rows* by Morton
code while leaving the *values* alone. The file's order was spatial; its chunk definition was not,
and it is the chunk definition a reader uses. `enrich_layout` now assigns `dense_id` in Morton order
and remaps every adjacency list. Measured by `corpus/measure-chunks.mjs`, five million in 41 chunks,
a window of 3,500 nodes:

| | by `dense_id` (what a reader fetches) | by physical row order |
|---|---|---|
| before | 40.8 of 41 | 2.0 of 41 |
| after | **2.0 of 41** | 2.0 of 41 |

**The two columns agreeing is the result**; the absolute number belongs to the corpus and the window
size. Retention is the control and did not move — 56.99% at 1M and 63.65% at 5M before and after,
because renumbering changes which integer a vertex wears and not where it is.

That control only worked after fixing the harness: both scripts picked their window centres by
`dense_id`, which *is* the thing under measurement, so the first comparison sampled different
windows in the two builds and read 63.65% against 52.89% for layouts that were byte-identical.
Centres are anchored to `subject` now. **Never seed a measurement with a value the change under test
is allowed to move.**

**And the chunks are files now, so a window fetches 10 of 4,883 of them — 0.2% of the corpus.**
`chunk_size` stays at the 1,024 the manifest always declared, because that was measured rather than
assumed: over-read is chunks-touched × chunk-size, and chunks touched barely grows as chunks shrink
(Morton locality means a window covers a near-constant *area*), so the smallest size prunes best —
**2.9×** at 1,024 against 8.0× at 8,192 and 70× at 122,880. 4,883 chunks write in seconds at 20 kB
each. Retention is again the control and did not move.

## Measured end to end, in the browser, and the second number moved the wrong way

Everything above is a proxy — what a window *contains*, how many chunks it *touches*. The sweep at
`/view/showcases/graph-bench`, tab visible, against the recorded run:

| nodes | first paint before → after | pan before → after |
|---|---|---|
| 2k | 100 → **65 ms** | 18 → 19 ms |
| 200k | 131 → **127 ms** | 48 → 43 ms |
| 1M | 258 → **326 ms** | 96 → **133 ms** |
| 5M | 1,006 → **1,217 ms** | 331 → **480 ms** |

ADR-0041 asked for the 5M pan to fall from 331 ms toward 40 ms. It rose to 480.

**It rose because the slice is now correct, and that is the finding.** A 20,000-vertex slice at a
million returns **131,030 edges**; under the old layout, at 0.26% retention, the same slice returned
roughly 360. The links query does about 365× the work it used to, and the old 331 ms was the price
of an almost edgeless dot cloud. **The two numbers ADR-0041 named were never independent: fixing the
first is what made the second harder**, and a 480 ms pan that draws the graph is not comparable to a
331 ms pan that draws points.

**Where the pan goes now, timed natively per query** (the three `detail()` issues, same window):

| | points | links | matched | sum |
|---|---|---|---|---|
| 1M | **30 ms** | 21 ms | 4 ms | 55 ms |
| 5M | **65 ms** | 66 ms | 8 ms | 139 ms |

**The links query is not the bottleneck, which corrects the guess above.** It returns 131,030 rows
where it used to return a few hundred and is still the *cheaper* of the two at a million; the points
query costs more, and **not** for the reason it looks like: `vis` computes two window functions over
everything the rectangle matched — 304,212 rows at 1M, 1,726,542 at 5M — but DuckDB turns that into
a top-N rather than a full ranking, which the returned `local` values prove by coming back
contiguous at 0..19,999. What costs is the scan itself. The rectangle is a quarter of the *space*
and matches 30% of the *corpus*, so "the working set is the window" is a statement about what is
returned and never was one about what is read.

**And that rectangle is the worst shape there is for a Z-order tiling.** The pan window is a quarter
of the width and the *full height*, which cuts across Morton locality rather than sitting inside it.
At a million, in nine chunks:

| window | chunks needed | rows matched |
|---|---|---|
| pan strip (quarter width, full height) | 7 of 9 | 304,212 |
| square of the same width | **4 of 9** | **73,738** |

A real camera shows something near the aspect ratio of a screen, not a full-height strip, so the
harness is measuring the one move that defeats the tiling it is meant to test. **The 480 ms pan is
an upper bound on a shape nobody pans in**, and fixing the window is worth doing before any more
query work is aimed at the number it produces.

**Reshaped, and the slice halves.** The pan window now takes its height from the canvas
(1200 × 800), which is what a viewport is. Timed natively per query, same walk across the corpus:

| | points | links | matched | **sum** | rows matched | chunks |
|---|---|---|---|---|---|---|
| 1M strip | 30 | 21 | 4 | 55 ms | 304,212 | 7 of 9 |
| 1M canvas | **11** | **12** | 3 | **26 ms** | 62,112 | **4 of 9** |
| 5M strip | 65 | 66 | 8 | 139 ms | 1,726,542 | — |
| 5M canvas | **24** | **26** | 6 | **56 ms** | 426,611 | 11 of 41 |

The links query barely moves — 120,239 rows against 131,030 — so the saving is the scan, exactly
where the chunk table above said it would be.

**Measured end to end, foreground tab, and the pan reverses.** Full sweep with the reshaped window:

| nodes | first paint | pan | vs strip | vs recorded |
|---|---|---|---|---|
| 2k | 89 ms | 18 ms | 19 | 21 |
| 200k | 120 ms | **42 ms** | 43 | 48 |
| 1M | 330 ms | **91 ms** | 133 | 95 |
| 5M | 1,227 ms | **275 ms** | 480 | 331 |

**The 5M pan goes 480 → 275 ms, which is under the 331 ms this file recorded before any of this
work** — while the slice returns about 120,000 edges where the old layout returned a few hundred. A
window that shows the graph now costs less than one that showed a dot cloud. It is still far from
the 40 ms band ADR-0041 asked for, but the direction is no longer wrong.

## What a window actually is, in the file — and why the planner cannot use it

A 20,000-vertex window at five million occupies **179 contiguous runs of `dense_id` covering exactly
20,007 ids** — 0.4% of the corpus, and **zero over-read**: every id inside a run is inside the
window. That is not luck. The layout is clumpy, a community is a compact disc, and a window holds
whole communities; each community is one contiguous Morton run.

Those runs hold **130,516 of 34,974,279 edges — 268×** — and restricting to them returns the same
120,103 visible edges, so it is a superset and not an approximation. The ideal slice reads 20,007
vertex rows and 130,516 edge rows. Today it scans 35M.

**And no way of asking for it in SQL gets it.** Measured, same window, same answer:

| | time | CPU |
|---|---|---|
| plain join over the whole edge table | **5 ms** | 37 ms |
| range join against the 179 runs | 237 ms | 1.9 s |
| 179 explicit `BETWEEN … OR …` predicates | 189 ms | 2.3 s |

Both attempts are *slower than not pruning at all*, because DuckDB evaluates the ranges per row over
35M rows instead of skipping. Row-group statistics do not save a disjunction of 179 ranges.

**So pruning cannot be expressed as a predicate. It has to be expressed as which files are read** —
and that is what chunking is for. This is a far better argument for the chunking than the one it was
shipped on: not that a chunk is a cacheable URL, but that **file selection is the only pruning the
reader can actually obtain**.

It also turns granularity into arithmetic instead of taste. At `src_chunk_size` 122,880 the window's
179 runs fall inside 3 partitions — 3 of 41 files, a 13× cut on the edge scan. Finer partitions
approach the 268× the data allows, and pay ~0.2 ms per file over localhost (measured above; more
over a network). The optimum is computable, and neither end of it is where we are today, which is
one file and no pruning at all.

## Does the pan stop growing with N? Asked properly at last, and no

Every pan number above is measured with a window that is a quarter of the **space**, and the space
grows with the corpus — 645,741 wide at a million, 5,289,639 at five, eight times the width for five
times the vertices. So the "same" window matched 62,112 rows at a million and 426,611 at five: it
was measuring *zooming out in proportion to the corpus*, which no reader does, and could only grow
with N by construction. The window now holds **20,000 vertices whatever the corpus is** — sized by
rank, the same definition `corpus/measure-retention.mjs` uses.

| nodes | 2k | 10k | 50k | 200k | 1M | 5M |
|---|---|---|---|---|---|---|
| pan | 21 ms | 21 ms | 25 ms | 36 ms | **77 ms** | **256 ms** |

**It is sublinear and it is not flat.** Twenty-five times the corpus, from 200k to 5M, costs seven
times the pan — with the same number of vertices on screen throughout. ADR-0041 asked for a pan that
stops growing with N and this is the first measurement able to answer it.

**The term that grows is the edge scan, and two guesses at it were wrong before the measurement
landed.** Written down because both were plausible:

*Guess one: over-read.* A true 20,000-vertex window touches **2 chunks at a million and 3 at five**
— 245,760 and 368,640 rows, 12× and 18× over-read, growing 1.5× where the pan grows 3.3×. (The
"4 of 9 and 11 of 41" figures this paragraph used to carry were the old fraction-of-space window,
not this one.) Over-read is real and is not what scales.

*Guess two: Z-order locality.* Tested before writing any Rust, by ranking the same corpus with
`ST_Hilbert` and counting again: **3.0 chunks against Morton's 3.0**. Hilbert buys nothing here, so
that lever does not exist either.

*What does scale.* Timed natively with the constant window, `points` is **flat** — 2 ms at a million
and 2 ms at five — and `links` is 6 ms against 7. But `links` spends 17 ms of CPU at a million and
45 at five, **2.6×**, because it joins against the whole edge table: 6.9M rows against 35M, one file,
no chunking, no spatial order. Native DuckDB hides that behind fourteen threads. **DuckDB-WASM has
one**, so what native absorbs, the browser pays in wall-clock — which is exactly the 77 → 256 ms.

So the vertices were tiled and the edges were left as a single file, and the edges are the half that
grows. Chunking them is no longer a completeness item; it is the lever.

**First paint is the half that did not improve**: 330 ms at 1M against 253 recorded, 1,227 against
1,006. It opens on the whole extent rather than a window, so reshaping the pan does nothing for it —
it scans everything and lets the limit truncate.

And the projections in the previous paragraph were **optimistic by about 1.4×** (62 and 193 against
91 and 275 measured). Scaling native timings by a per-size WASM factor gets the shape right and the
magnitude wrong; it is worth doing to choose between options, not to report.

**Chunking is not what costs, once `chunk_size` is right.** At 1,024 rows it was a disaster —
977 files, 196 ms against 2 ms for a single file on the identical query over HTTP, and a 200k pan of
7.8 s in the browser against 48 ms recorded. The cost is linear in the file count at ~0.2 ms each
*over localhost*, where a request is nearly free. `chunk_size` is now 122,880, DuckDB's default row
group, so a chunk is exactly one row group; at 9 files a million costs 3 ms against the single
file's 2, which is inside the noise.

That correction is the same one the pan-cache table below invites. Its "1,024 wins by 17×" is in
**rows**, and rows are the wrong currency: in milliseconds 1,024 loses by 65×. Both numbers are
kept, because the pair is the lesson.

**And the cache claim, measured over a pan** (`corpus/measure-pan.mjs`) — because chunks-touched is
identical whether a chunk is a file or a `dense_id` range, so it cannot see what emitting them
separately bought. Eight drag steps of a quarter of the window's width, five million:

| `chunk_size` | hit rate | chunks fetched | **rows over the pan** |
|---|---|---|---|
| 1,024 | 85% | 21 of 79 touched | **21,504** |
| 8,192 | 97% | 6 | 49,152 |
| 32,768 | 100% | 4 | 131,072 |
| 122,880 | 100% | 3 | 368,640 |

**The hit rate is a trap.** It improves with bigger chunks for the reason that makes it worthless: a
chunk large enough to contain the whole pan is fetched once and never missed again, so it scores
perfectly by having already downloaded everything. The payload column is the comparable one, and on
it 1,024 wins by seventeen times. Read the bytes, not the percentage.

Two things worth not rediscovering. **A glob is the wrong way to read them**: expanding
`vertex/Node/*.parquet` means listing a directory, and a plain HTTP origin has no listing — DuckDB's
httpfs *can* glob against S3, so the mistake works against `file://`, works against a bucket, and
fails in the browser. The reader derives the chunk list from the vertex count and `chunk_size`.
And **`--row-group` is gone**: a chunk of 1,024 rows *is* one row group, so there is nothing left
for a row-group size to be smaller than. The result above stands as the record of what it bought,
which was nothing, twice.

## What to fix, in order

**DuckDB is not the bottleneck.** The query column stays in single-digit milliseconds while
everything around it grows. The database was never the thing to worry about.

**`load()` is.** It is the largest cost we own, and it is plain main-thread JavaScript turning
Arrow into ids, a `Map`, rows, and typed arrays. It belongs in a worker, and much of it belongs
in SQL — the index and the ordering are things DuckDB would do for free.

**The upload is cosmos.gl's, and it dominates both layers equally.** Layer 1 and layer 2 agree
on it to within a few per cent for the same data, which is the cross-check that says the
harness is measuring the same thing twice rather than measuring itself.

**`buffers()` is cheap and can stay where it is.**

## The window is flat in N — and it is the curve, not the communities

`measure-runs.mjs`, five windows of 20,000 vertices at each size, same window definition as
`measure-retention.mjs`.

| N | mean runs | vertex over-read | mean edges fetched | vs the whole edge table |
|---|---|---|---|---|
| 200k | 170.2 | **1.0000×** | 139,970 | 9.8× |
| 1M | 141.8 | **1.0000×** | 160,775 | 42.9× |
| 5M | 169.4 | **1.0000×** | 129,466 | **270.1×** |
| 10M | 248.2 | **1.0000×** | 147,134 | **482.7×** |

Repeated at twenty windows, because the per-window spread is wide enough (47 to 471 runs at ten
million) that five samples cannot separate a trend from noise:

| N | mean runs | mean edges fetched |
|---|---|---|
| 1M | 176.0 | 144,962 |
| 5M | 184.3 | 134,608 |
| 10M | 261.8 | 140,778 |

**Edges fetched is flat and run count is only bounded.** 135–145k edges per window across fifty
times the corpus is the number that matters — it is the term that dominates the scan, and it does
not follow N. The run count sits in the low hundreds throughout but ten million is ~1.4× five
million, which four points cannot call growth or noise. The corpora themselves are not evenly
spaced either: the layout's width goes 208k → 646k → 5.29M → 8.09M for 200k → 1M → 5M → 10M
vertices, so density is not constant across the family and a fixed-*vertex-count* window covers a
different amount of space at each size. Settling it needs either more sizes or a window fixed by
area.


**Both numbers are flat.** Twenty-five times the corpus leaves the run count at ~170 and the edges a
window fetches at ~130–160k. The reduction grows only because the denominator does. This is the
claim ADR-0042 rests on and it had been measured once, at one size, by hand — the conclusion it
carries is about *scaling*, and one point cannot support it. It survives.

**Over-read is exactly zero, not nearly.** 20,000 ids covered for 20,000 wanted, every window, every
size. Edge over-read is 1.08–1.64× against what is actually drawable.

The control: **20,000 ids drawn at random are 19,916 runs.** The spatial window is 169. So the
contiguity is real and it is the ordering that produces it — a 118× difference.

### Writing ten million costs 16.4 GiB, which is the larger-than-RAM claim failing early

`/usr/bin/time -l` over the whole build — the generator plus `fossil run` — at ten million vertices
and 71,024,690 edges:

| | |
|---|---|
| wall clock | **262.6 s** |
| peak RSS | **16.4 GiB** |
| corpus on disk | 713 MB |

**Twenty-three times the corpus, resident.** ADR-0042 calls larger-than-RAM the central claim of the
architecture and records that it has never been tested; this is the first number against it, and it
is about the *writer*. The reader's working set is a window and is not implicated — but a corpus
nobody can write is not a corpus anybody can read, and the ADR says as much: *"que fossil no pueda
escribir un corpus larger-than-RAM sería un hallazgo tan importante como cualquiera de lectura."*

For scale, the same build with the pre-layout binary took 123.3 s, so the layout pass is roughly
half the wall clock. Louvain running in memory over the whole graph is the suspected term and is
not yet isolated — that measurement is a fossil-side task, not one this harness can take.

### The sixteen gigabytes are the executor's, not the corpus's — and a budget takes them to 9.87

Measured 2026-08-05 on the fossil side (`FOSSIL_MEM_PROBE=1`, rmlext `d52b6c5`/`cc48499`), over
`fossil run` alone on the same ten-million CSVs. Not the whole build: the generator is not in the
process, which is why these figures and the 16.4 GiB above are not the same measurement.

**The graph that gets handed to the writer is 1.64 GiB.** Every vertex batch plus both orientations
of every edge table — 10M vertices, 71,024,690 edges — counted in Arrow. The process holds **15.68
GiB** at that moment. The resident corpus is a tenth of the residency.

| phase | RSS after | delta |
|---|---|---|
| prepare vertices (lazy) | 0.07 G | +0.00 G |
| collect vertex `Node` | 8.01 G | **+7.94 G** |
| collect edge table | 15.68 G | **+7.67 G** |
| — of which retained in Arrow | 1.64 G | |
| drop the `SessionContext` | 15.68 G | +0.00 G |
| encode 6 files | 16.26 G | +0.58 G |

Two readings say the same thing. Dropping the executor's context frees **nothing** — its `MemTable`s
are the same Arrow buffers, not a second copy — and the edge collect measured +7.67 GiB on one run
and **+11.35 GiB** on the next of the identical corpus. Live data does not vary by 3.7 GiB.

**What it is: DataFusion operator memory nobody had bounded.** `SessionContext::new()` is an
unlimited pool with no spill. Given a 4 GiB pool, the vertex sort/dedup over ten million IRIs spills
and lands at 3.02 GiB — but the run dies in the edge phase, and the pool's consumer tracking names
why without a hypothesis: `HashJoinInput[8](can spill: false) consumed 387.7 MB`, five such, one
reservation per partition on a 10-core machine. A hash join's build side, told it may not allocate,
has nothing to give back. A sort-merge join spills.

With both — a declared budget and a join that can honour it:

| ten million | unbounded | 4 GiB + sort-merge |
|---|---|---|
| RSS after `execute_graph` | 15.68 GiB | **5.56 GiB** |
| RSS entering `enrich_layout` | 16.51 GiB | **6.82 GiB** |
| process peak | ~21 GiB | **9.87 GiB** |
| wall clock | 256.3 s | 290.9 s |

**The output is byte-identical** — 87 files, every md5 equal — so this is a memory result and not a
different corpus. What remains above the budget is Louvain (+2.22 GiB) and the layout pass, which is
where ADR-0042 predicted the cost in the first place.

On which number to quote: `/usr/bin/time -l` reports *maximum resident set size* 21.1 GiB and *peak
memory footprint* 15.6 GiB for the unbounded run, and the two unbounded runs differ from each other
by 2.3 GiB. Under the budget they converge — 9.87 GiB by both the probe's peak and `time`'s maximum
RSS. A figure that moves between identical runs is measuring the allocator as much as the program,
which is its own argument for bounding it.

### But a bounded executor is not larger-than-RAM: the writer still grows with N

The same 4 GiB budget at both sizes, so the only variable is the corpus:

| under a 4 GiB budget | 1M | 10M | ratio |
|---|---|---|---|
| retained in Arrow | 0.16 GiB | 1.64 GiB | **10.3×** |
| RSS after `execute_graph` | 2.02 GiB | 5.56 GiB | 2.8× |
| RSS entering `enrich_layout` | 2.13 GiB | 6.82 GiB | 3.2× |
| process peak | 2.43 GiB | 9.87 GiB | **4.1×** |
| wall clock | 17.8 s | 290.9 s | 16.3× |

Ten times the corpus, four times the peak. The pool caps the executor and nothing else, and **three
terms outside it are unbounded in N** — the retained Arrow exactly so, 10.3× for 10×.

They are all ours, and all the same shape: a stage boundary that is a whole value rather than a
stream. `GraphArData` holds every batch before a byte is written; `to_files()` encodes every Parquet
file before touching disk (+0.58 GiB at ten million); and the layout pass reads the whole edge list
into a `Vec` while Louvain holds O(n) state (+2.22 GiB). The engine streams — DataFusion hands
batches out lazily — and our seams collect. That is a property of the seams we wrote, not of the
executor, and it is the same finding rmlext ADR-0043 reached one floor down when `query_map` turned
out to materialise while `stream_arrow` is genuinely lazy.

So the claim that survives today is narrower than "larger-than-RAM works": **the write path can now
be given a memory budget it will honour**, which it could not before. Whether a corpus larger than
the machine can actually be written is untested, and on these numbers the answer at 100M would be
no.

### But the explanation in the ADR is wrong, and §3 rests on it

ADR-0042 says *"la maquetación es grumosa, una comunidad es un disco compacto y una ventana contiene
comunidades **enteras**; cada comunidad es un tramo Morton contiguo"*, and §3 builds the tile
pyramid on it: **una tesela es una comunidad**. Measured at five million, neither cluster column can
be that:

| column | groups | mean | p50 | p90 | max | runs per group |
|---|---|---|---|---|---|---|
| `community` | 8 | 625,000 | 625,192 | 625,562 | 625,916 | **5,461** |
| `cluster_id` | 15,310 | 326.6 | **1** | 3 | 163,787 | 1.72 |

A window is 169 runs of ~118 ids. `community` has eight groups and each one is shattered into five
thousand id runs, so it is neither compact nor contiguous. `cluster_id` groups *are* nearly
contiguous — 1.72 runs each — but **the median one is a single vertex** and nine in ten are three or
fewer, so a 20,000-vertex window touches thousands of them, not 169.

**What produces the runs is the space-filling curve, and nothing else.** A rectangle over a Morton
order maps to O(√n) curve segments; that is the whole mechanism, and it is why the count does not
follow N. The clustering is not doing this work.

That leaves §3 without its premise. A tile cannot be a community: at a median of one vertex it is
not a payload, and merging communities into one costs the contiguity unless they are already
Morton-adjacent — at which point the tile is a Morton range, which is exactly what §3 dismissed as
*"una aproximación gruesa de esto"*. The measurement says the approximation is the thing.

**What is still open.** This does not say the hierarchy is useless — it says the hierarchy is not
what makes a window cheap to *fetch*. Whether it is what makes a zoomed-out view mean anything is a
different question and is unmeasured.

## Requests and bytes per pan — and the request count is the term that follows N

Measured 2026-08-05 by `corpus/measure-requests.mjs`. The corpus is served over a **plain HTTP
origin** — single range, no directory listing, no coalescing proxy, which is what a bucket or a CDN
looks like from the reader's side — and the server that answers logs every request it writes. The
reader is `duck-source.ts`'s `detail()` verbatim: two Parquet **views**, then points, links and
matched per step, over the chunk list derived from the vertex count. Six drag steps, window sized by
rank at 20,000 vertices and then held fixed.

Bytes are priced over the **projected** columns, out of the footers: 8.9–9.4 B per vertex row for
`dense_id, x, y, community` and 3.5 B per edge row. Not file size over rows — `subject` is 45% of a
vertex chunk and no drawing query names it, so pricing that way would inflate the ideal payload by
nearly two and flatter every ratio computed against it.

**Arriving at a window, nothing cached** — a deep link, a reload, a jump. Mean of six windows:

| N | vertex chunks | requests | of which HEAD | bytes | ideal | over-read |
|---|---|---|---|---|---|---|
| 200k | 2 | 17.0 | 7 | 2.39 MB | 0.93 MB | 2.6× |
| 1M | 9 | 55.0 | 28 | 5.35 MB | 0.70 MB | 7.7× |
| 5M | 41 | 208.3 | 124 | 12.12 MB | 0.64 MB | **18.9×** |
| 10M | 82 | 375.7 | 247 | 13.05 MB | 0.92 MB | 14.2× |

*Ideal* is the payload a reader that could address `dense_id` runs exactly would move: the covered
vertex rows plus every edge whose source is in those runs. It is **flat in N at 0.6–0.9 MB**, which
is the same claim the run table above makes in rows, now in bytes. What is not flat is the traffic
that fetches it.

**The request count is metadata, and it is linear in the corpus.** The HEAD column is exactly
`3·chunks + 1` at every size — 7, 28, 124, 247 for 2, 9, 41, 82 chunks — because DuckDB revalidates
every file in the list once per query and there are three queries in a slice. Probed on one bbox
query over the million-node corpus, the whole shape falls out: **20 requests for 9 chunks**, being
one HEAD and one 16,384-byte footer read for each of the nine, plus a second HEAD and one data range
on the single chunk that actually intersected the rectangle.

    HEAD chunk0 · GET chunk0 bytes=…  16,384      ← footer, every chunk
    HEAD chunk1 · GET chunk1 bytes=…  16,384
    …
    HEAD chunk0 · GET chunk0 bytes=… 684,109      ← data, the one chunk that matched

So a window costs **~4 requests per chunk in the corpus** and a bounded number for the chunk it
wants. 169 ranges per window was the wrong thing to be afraid of: the reader never issues 169
ranges, it issues 376 requests, most of them about files it will not read. At ten million, 85 of the
~129 body-carrying requests in a window are 16,384-byte footer reads — 1.3 MB of the 13.05 —
almost all of them for chunks the window does not touch.

**A drag is cheaper in bytes and barely cheaper in requests**, for the same reason — one session,
caches carried across the six steps:

| N | drag, per step | vs arriving cold | bytes per step | vs cold |
|---|---|---|---|---|
| 200k | 10.3 requests | 17.0 | 0.74 MB | 2.39 |
| 1M | 37.2 | 55.0 | 1.92 | 5.35 |
| 5M | 143.8 | 208.3 | 3.31 | 12.12 |
| 10M | 287.2 | 375.7 | 6.16 | 13.05 |

Two of the six steps at ten million transfer **zero bytes** and still cost 247 requests each. A
cache answers the payload; nothing answers the metadata.

**The over-read ratios in rows are unchanged and are the check on all of this.** Every window, every
size: vertex `covered / wanted` = **1.0000×**, and edge `fetched / visible` is 1.06–1.17× over
these six windows, inside the 1.08–1.64× `measure-runs.mjs` reports over twenty. The
five-million step 0 reproduces the recorded window to the row — 179 runs, 20,007 ids, 130,516 edges
— which is what says the harness is panning across the corpus this file has been describing and not
some other one.

Below 200,000 there is no pan to measure. A 20,000-vertex window is most of a 50,000-vertex corpus,
so the walk leaves it after two steps, and the reader does not slice a corpus that fits either.
Measured with the window scaled down to N/8 they cost 7.0, 9.0 and 9.5 requests at 2k, 10k and 50k,
which is the floor: one file, opened.

### What tile size the arithmetic actually picks

A tile is a pre-coalesced run set, so its size is arithmetic over two measured curves. **Tiles
touched is exact** — a tile of `T` rows is the `dense_id` range `[i·T, (i+1)·T)`, so the set a window
touches is `count(DISTINCT node // T)` over the window's own ids and no file has to exist to count
it. **The cost of one tile is measured**, by writing real tiles at each size and reading them back
over the same origin with the same projection.

At five million, mean over the pan — vertex tiles carrying only the four drawing columns, edge tiles
keyed by source range, both measured:

| T | tiles | vertex tile | edge tile | requests | bytes | vs ideal | kB per request saved |
|---|---|---|---|---|---|---|---|
| 1,024 | 35.5 | 10.8 kB · 2 req | 21.2 kB · 3 req | 178 | **1.11 MB** | 1.73× | — |
| 2,048 | 21.2 | 19.0 · 3 | 38.6 · 3 | 127 | 1.19 MB | 1.86× | 1.7 |
| 4,096 | 13.0 | 36.0 · 3 | 80.7 · 3 | **78** | 1.48 MB | 2.31× | 6.0 |
| 8,192 | 7.8 | 71.1 · 3 | 176.7 · 3 | 47 | 1.89 MB | 2.95× | 13.3 |
| 32,768 | 3.5 | 283.0 · 3 | 1,065.7 · 4 | **25** | 4.61 MB | 7.20× | 125 |
| 122,880 | 2.8 | 1,132.0 · 3 | 3,156.0 · 9.4 | 35 | 11.73 MB | 18.3× | dominated |
| today | — | — | — | 208 | 12.12 MB | 18.9× | — |

**Today's 122,880 is Pareto-dominated by 32,768** — more requests *and* four times the bytes — and it
is the only pair in the table that is. A 122,880-row edge tile is 830,512 rows and spans several
Parquet row groups, so DuckDB issues 9.4 requests for it against 4 for the 32,768 tile. Every tile
size in this table beats the corpus as it stands on both axes at once.

**Bytes bottom out at 1,024–2,048 rows and rise from there; requests fall monotonically.** The two
curves have no common optimum, so the last column is the exchange rate: what one saved request
costs in extra traffic. Compare it against `λ·β`, the bytes a link moves in one request's latency:

- **serial requests**, 30 ms RTT on 100 Mbit → λ·β ≈ 375 kB → take **32,768** (125 < 375, and 122,880
  is dominated).
- **six in flight**, HTTP/1.1 in a browser → λ·β ≈ 62 kB → take **8,192**.
- **fully multiplexed**, HTTP/2 with every address known before asking → λ·β ≈ 12 kB → take **4,096**.

**So the data does not decide it on its own; the transport does — and the transport is ours.** The
whole point of ADR-0042's *addressed, not queried* is that a tile reader computes every URL it needs
before it issues the first one, so the requests go out together and latency stops multiplying. Under
that assumption the answer is **4,096 rows**: 78 requests and 1.48 MB at five million against today's
208 and 12.12 MB, at 2.31× the run-addressed ideal. The byte curve is flat-bottomed from 1,024 to
8,192 — 1.11 to 1.89 MB — so the choice *inside* that band is not load-bearing and the emitter should
not be tuned within it.

**The tile should carry only what the drawing path reads.** Measured at five million, a tile with all
six vertex columns costs 4 requests and 37.0 kB fetched of 68.8 kB stored; the same rows with
`dense_id, x, y, community` alone cost **3 requests and 36.0 kB of 36.0 kB**. Same bytes on the wire,
one less round trip, half the storage — because the projected columns become adjacent and DuckDB
coalesces them into one range instead of reading around `subject`. That is an argument for a sidecar
for the properties, and it is the cheapest half of the payload-format question the roadmap asks next.

### What this cannot prove

- **It is DuckDB's httpfs from the CLI, not DuckDB-WASM in a browser.** The same extension and the
  same read pattern, but the browser adds an HTTP cache the CLI has not got and a different
  concurrency model. The per-file `3·chunks + 1` law should hold; it is unverified there.
- **Latency and bandwidth are not measured.** Localhost has neither. The three crossover points above
  are arithmetic over assumed λ and β, and the only measured inputs are the request and byte counts.
- **Nothing here measures how a reader learns which tiles it needs.** These figures are for a reader
  that already knows. The address arithmetic — a bbox to a set of Morton ranges — is unbuilt, and
  whether it costs a request of its own is not in this table.
- **Six windows per size, one corpus family.** The per-window spread of runs is wide (47 to 471 at
  ten million), and tiles-touched inherits it.
- **These are Parquet tiles.** A format that needs no footer would change both columns, which is
  exactly what makes the payload format a separate decision and not a detail of this one.
- **No time is measured here at all** — only traffic. A pan that moves fewer bytes in more requests
  can still be slower, and the milliseconds live in the tables above this one.

## The last harness run, verbatim

Machine-owned. `run-bench.mjs` overwrites everything between the two markers below and nothing
outside them, so this is raw output waiting to be read — not a section to edit, and not one to
trust over the dated layers above until someone has folded it in.

<!-- run:start -->
_No run recorded since the runner stopped owning this file._
<!-- run:end -->
