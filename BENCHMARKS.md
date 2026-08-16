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

**Superseded, and by two changes at once — read it as history.** The corpus below was written at a
tile size fossil has since retired, and it was read by a source that handed DuckDB every chunk URL
and pruned with a `WHERE`. Both halves changed. The rows further down measure the same sweep after
each change, and the page's own "recorded" tiles were rebaselined to the later run rather than left
quoting this one beside live numbers.

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

### The same sweep after the tile size moved — and it got 3.7× slower

Re-run 2026-08-15, on the corpora rebuilt that day, single-threaded (`crossOriginIsolated` false
on 14 cores), Chrome driven over the dev server. Same harness, same fixture shape, same code
path.

| Nodes | Links | Ingest | `total()` | First slice | With subject | Upload | **First paint** | Pan | Redraw | Shown / matched |
|---|---|---|---|---|---|---|---|---|---|---|
| 2k | 12.5k | 10,718 ms | 16 ms | 98 ms | 22 ms | 31 ms | **145 ms** | 81 ms | 1,493 fps | 2k / 2k |
| 10k | 69k | 62 ms | 10 ms | 29 ms | 25 ms | 37 ms | **75 ms** | 26 ms | 368 fps | 10k / 10k |
| 50k | 332k | 90 ms | 14 ms | 59 ms | 59 ms | 32 ms | **105 ms** | 52 ms | 238 fps | 20k / 50k |
| 200k | 1.37M | 256 ms | 59 ms | 168 ms | 161 ms | 33 ms | **259 ms** | 123 ms | 272 fps | 20k / 200k |
| 1M | 6.90M | 1,423 ms | 180 ms | 724 ms | 648 ms | 28 ms | **931 ms** | 534 ms | 325 fps | 20k / 1M |

The 2k ingest is DuckDB-WASM booting and fetching httpfs — a first-use cost the first size pays
for the whole sweep, and the same one the note above records at around twenty seconds.

**Against the run above: 253 ms became 931 ms at a million, and 132 became 259 at 200,000.** The
smaller sizes barely moved. Every figure that grew is one that reads Parquet.

**Why, isolated the same day — and the first guess was wrong about the mechanism.** The corpus was
rebuilt with fossil's new tile size, so a million vertices went from 9 chunk files to 245 and the
row groups inside them went from 122,880 rows to 4,096. Two variables moved together. Pulling them
apart needs the same rows in three containers, which `duckdb` can write:

```sql
COPY (SELECT * FROM read_parquet([…245 chunks…]) ORDER BY dense_id)
  TO 'all.parquet' (FORMAT PARQUET, ROW_GROUP_SIZE 4096);   -- and again at 122880
```

Same bytes — 17 MB either way — same tiling arithmetic, same first-slice query, over the same HTTP
origin. Native `duckdb`, five cold processes per arm, median:

| container | row groups | median |
|---|---|---|
| 245 files | 245 × 4,096 | **217 ms** |
| one file | 245 × 4,096 | **129 ms** |
| one file | 9 × 122,880 | **41 ms** |

**The file count costs 1.7×; the row-group size costs 3.1×.** The first guess named the file count
and it is the smaller term. Together they are 5.3×, which brackets the 3.7× the browser showed.

The mechanism is the one the audit already names. A row group is the unit a reader *skips*, and
skipping is what the footer's statistics are for. **This reader skips nothing** — it hands DuckDB
every URL and a `WHERE`, so every row group is opened and decoded whatever its box says. For a
reader like that, cutting the tile finer is pure metadata with no pruning to pay for it. The corpus
picked 4,096 for the reader its conventions describe, one that computes every URL before it issues
the first and selects row groups from the footer; it is the right number for that reader and the
wrong one for ours.

**What this is not.** Native DuckDB, multi-threaded, over a local origin — not DuckDB-WASM
single-threaded in a tab, which is what the table above measures. The direction and the mechanism
carry; the magnitude need not. And "cold" here means a fresh process, not a cold page cache: the
first run of each arm was slower (661 ms for the large-row-group file) and is excluded from the
median, so the comparison is warm-server for all three.

**It is the sharpest argument yet for the addressed reader.** `.planning/READER-VS-CORPUS.md` §2
calls reading an addressed corpus with a predicate our one head-on divergence with the conventions,
and this is the first time it has a cost attached: **5.3× on the query that is first paint.**

### The addressed reader is not a rewrite — it is a list of URLs, and it is 60×

Measured 2026-08-15, native `duckdb` over the dev origin, the million-vertex corpus. A pan window
sized by rank — the Chebyshev square around the centre holding 20,000 vertices, the same definition
the harness uses — against the same bbox query.

**16 of 245 tiles intersect it.** That is the Morton order doing its job: 6.5% of the corpus, from
arithmetic on boxes the footer already carries.

| what the query is handed | cold, three runs |
|---|---|
| all 245 chunk URLs, pruned with `WHERE` | 2.489 s · 0.258 s · 1.676 s |
| **only the 16 intersecting URLs** | **0.028 s · 0.021 s · 0.032 s** |

**Roughly 60× against the median, and 9× against the fastest run the slow arm managed.** The spread
in the top row is itself the finding: 245 HTTP resources per query is not a stable cost.

**And it needs no Parquet decoder.** This is the thing that was assumed to be expensive and is not.
fossil writes **one file per tile**, so *choosing what to read* — which the conventions insist is
what pruning is, as against selecting rows with a predicate — reduces to choosing which URLs go into
`read_parquet([…])`. Three steps, all of them DuckDB:

1. once per corpus, `parquet_metadata` over the chunks for each tile's `x`/`y` box;
2. per camera move, keep the tiles whose box intersects the window — plain arithmetic, no query;
3. `read_parquet([those URLs])` with the same bbox clause as today.

No byte-range fetching, no Arrow IPC, no new dependency. The `WHERE` even stays, because inside the
16 tiles it is doing the cheap job it is good at rather than standing in for the pruning.

**Where it does not help, and it matters.** The *first* slice asks for the whole extent, where every
tile intersects and this buys nothing. The win is on **pan** — which is the number the harness says
decides how the view feels, and which is 534 ms at a million today.

**What this is not.** Native DuckDB, not WASM in a tab. The footer pass is a one-time cost not timed
here and it is the one thing that could eat into the win at small corpus sizes. And the window is one
window at one zoom, not a distribution.

### And the edge join was the wrong suspect — 1.3×, not the term that scales

Same window, same corpus, same day. The edges a window can draw, read two ways:

| the edges of that window | cold, three runs |
|---|---|
| the flat `by_source.parquet`, 6.9M rows, hash-joined | 0.081 s · 0.044 s · 0.048 s |
| the 16 `by_source/tile{k}.parquet` the window already addresses | 0.034 s · 0.037 s · 0.037 s |

**1.3×.** The standing claim — repeated in this file and in the reader's own comments — is that the
edge join is *the one part of a slice that scans something proportional to the corpus with nothing to
prune*, and therefore the term that makes first paint grow with N. On this measurement it is not: at
a million the whole edge side is tens of milliseconds against a 724 ms slice.

Two reasons it is cheaper than it reads. The relation is two `uint32` columns and nothing else, so
6.9M rows is a small file; and `by_source.parquet` is CSR — sorted by `src_dense` — so its row-group
statistics on the join key are exactly the thing a scan can skip on.

**So reading edges by tile is elegance, not speed.** It is still the right shape — one address should
serve both relations, and the corpus went to the trouble of keying edge tiles by the vertex tiles —
but it should be adopted for what it is, and the performance argument belongs to the vertex side.

**Where the first slice actually goes, and three refuted suspicions.** Broken down in one session,
full extent, a million:

| the three queries a detail slice issues | cold, in order |
|---|---|
| points — the CTE and its projection | **276 ms** |
| links — the same CTE, joined twice against the edge relation | 85 ms |
| `matched` — `count(*)` over the same predicate | 46 ms |

**The first query is the slice.** The other two are nearly free because the bytes are already read.
That refutes all three things this file and the reader's comments had suspected in turn: the edge
join is not the term that scales (1.3× when addressed, and 85 ms here); the `matched` count is the
smallest of the three, not a hidden scan; and materialising the visible set once instead of inlining
the CTE into three queries — the obvious de-duplication — is **391 ms against 407 ms**, which is
noise. There is no redundancy to remove.

So first paint is one cold read of every vertex tile, and at full extent **there is no addressing
that helps**: every tile intersects the opening view. The levers on that number are the container
and the row-group size (5.3×, above), or opening on something other than the whole corpus. Pan is a
different question with a different answer, and it is the one a reader feels.

**A methodology note, because it nearly produced a finding.** Timed as three separate `duckdb`
processes the same three queries read 285 / 300 / 167 ms — summing to 752, which matches the
browser's 724 ms slice almost exactly and looks like a decomposition. It is not one: each process
paid its own cold scan. Three cold reads of the same bytes will always sum to about the thing you
are trying to explain.

### The pan stopped growing with N — 534 ms to 72, and flat from 200k

The first sweep through `corpusSource`, 2026-08-15, same machine and same single-threaded DuckDB as
the run above. The reader now takes the chunk size and the prefixes from the manifest, finds the last
tile by probing, reads each tile's box from the footer once, and per camera move hands
`read_parquet` only the tiles whose box intersects the window.

| Nodes | Ingest | `total()` | First slice | With subject | Upload | **First paint** | **Pan** | Shown / matched |
|---|---|---|---|---|---|---|---|---|
| 2k | 150 ms | 0 ms | 42 ms | 46 ms | 27 ms | **69 ms** | **17 ms** | 2k / 2k |
| 10k | 68 ms | 0 ms | 34 ms | 78 ms | 34 ms | **68 ms** | **26 ms** | 10k / 10k |
| 50k | 102 ms | 0 ms | 92 ms | 145 ms | 32 ms | **124 ms** | **59 ms** | 20k / 50k |
| 200k | 200 ms | 0 ms | 268 ms | 285 ms | 31 ms | **299 ms** | **73 ms** | 20k / 200k |
| 1M | 679 ms | 0 ms | 1,193 ms | 888 ms | 28 ms | **1,221 ms** | **72 ms** | 20k / 1M |

**Pan: 81 · 26 · 52 · 123 · 534 became 17 · 26 · 59 · 73 · 72.** At a million that is 7.4×, and the
shape is the finding rather than the factor: 73 ms at two hundred thousand and 72 at a million. The
claim the whole bounded architecture rests on — *the working set is the window, not the corpus* — is
true of the number a reader actually feels, for the first time.

`total()` reads zero because it is answered from the tile pass rather than by counting; that cost
moved into `ingest`, where the fixture's own work belongs.

**And first paint got worse: 931 ms to 1,221 at a million.** That is not a regression to fix, it is
the trade stated plainly. The opening view is the whole extent, every tile intersects it, and
addressing cannot read fewer bytes — so the footer pass and the probe are added cost with nothing to
recover them. `decisions/a-tile-is-an-address-not-a-verb.md` predicted exactly this before the code
was written, which is the only reason it is being published rather than explained away.

**`matched` is the whole corpus at every size**, which is what says the manifest-driven tile count is
right: a reader that derived too few tiles would report a smaller corpus and a faster everything.

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

**DuckDB is the bottleneck, and it gets one core.** What stays in single-digit milliseconds is
`total()` — 7–9 ms at every size, because it is Parquet metadata. The slice is not: `detail()`'s
three queries cost 55 ms at a million and 139 ms at five, and the honest statement of the
architecture is **bounded rendering, unbounded querying**. `threads` is 1, cross-origin isolation
does not change it, and what native DuckDB absorbs across fourteen cores the browser pays in wall
clock.

**The growing term is the edge scan.** With a window holding 20,000 vertices whatever the corpus
is, `points` is flat — 2 ms at a million and 2 ms at five — and `links` is 6 ms against 7, but
spends 17 ms of CPU against 45, because it joins the whole edge table: 6.9M rows against 35M, one
file, no chunking, no spatial order. The vertices were tiled and the edges were left alone, and the
edges are the half that scales. That is the 77 → 256 ms pan.

In the order the measurements support:

1. **Chunk the edge file.** Not a completeness item — the lever. It is the term that follows N, and
   nothing else on this list touches it.
2. **Issue `detail()`'s three queries on separate connections.** They go out under `Promise.all`,
   but Mosaic funnels them through one connection and fulfils in strict FIFO, so they serialise: the
   sum is 75 ms where the slowest is 35. Worth more than any file-layout change on this list.
3. **Emit tiles at 4,096 rows.** 78 requests and 1.48 MB per cold window at five million against
   today's 208 and 12.12 MB, at 2.31× the run-addressed ideal. Today's 122,880 is dominated by every
   other size in that table, on requests *and* bytes.
4. **A tile cache.** The only item here that no amount of query tuning can substitute for: it is
   what makes panning *back* free. It answers the payload and not the metadata — two of six drag
   steps at ten million transfer zero bytes and still cost 247 requests each, which is what item 3
   is for.

**`buffers()` is cheap and can stay where it is.** 1, 2, 8 and 33 ms at 2k through 200k.

**The upload is flat and is not on this list.** 23–30 ms at every size on the bounded path, because
the slice is capped at 20,000 marks — 24 ms of a 253 ms first paint at a million. The 788 ms it cost
in layer 2 was the price of holding the corpus, and that architecture is gone.

**What used to top this list left with it.** `load()` read the whole relation into ids, a `Map`,
rows and typed arrays — 386 ms at 200,000 nodes, 148 of them building the id→index map. ADR-0001
deleted it rather than moving it to a worker, and the SQL half of the old plan landed with it:
`row_number() - 1` inside the CTE numbers the visible set, so a slice's links already speak in
buffer positions and no map is built in JavaScript at all.

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
claim the addressing design rests on and it had been measured once, at one size, by hand — the conclusion it
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

**Twenty-three times the corpus, resident.** The architecture calls larger-than-RAM its central
claim and had recorded that it was never tested; this is the first number against it, and it
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
where the design predicted the cost in the first place.

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

The addressing design says *"la maquetación es grumosa, una comunidad es un disco compacto y una
ventana contiene comunidades **enteras**; cada comunidad es un tramo Morton contiguo"* — it lived in
rmlext ADR-0042 until `43991ac` deleted `decisions/`, and now in
`apps/corpus/content/docs/conventions/addressing.mdx` — and §3 builds the tile pyramid on it:
**una tesela es una comunidad**. Measured at five million, neither cluster column can
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
whole point of *addressed, not queried* is that a tile reader computes every URL it needs
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

## A knowledge graph, and what several vertex types cost

Everything above this line is **one vertex type and one edge type**: a hyperbolic random graph,
`bench.fossil`, `Node` and `linksTo`. The flat 135–145k edges per window, the 1.0000× vertex
over-read, the 169 runs, the 4,096-row tile — one corpus family, all of it. `place_after` has never
been exercised and cross-type edges have never existed, so nothing above knows whether it is
describing the architecture or describing that family.

`kg.fossil` and `corpus/build-kg-corpus.mjs` are the second family, written by the same writer.
Four vertex types — `Paper`, `Author`, `Venue`, `Topic` — and five edge types, three of which cross
types. `Paper` and `Author` have a self-edge each (`cites`, `coauthoredWith`); `Venue` and `Topic`
have none, which is the case where the layout has no topology and every vertex becomes its own
community. The cross-type edges are **community-aligned on purpose**: a paper draws its authors,
venue and topics from the band of the other type matching its own community, which is the friendliest
input a layout could be given. Built with fossil at rmlext **`995bdad`**, rebuilt into a scratch
target — `8484b7e`, the tip at the time, does not compile (`fossil-ide/src/lib.rs` declares
`pub mod lineage;` for a file `dfd46fe` moved to `fossil-registry`), and 995bdad's `layout.rs` and
`fossil-engine` are byte-identical to it.

Sizes are total vertices, so 1M here and 1M above are the same corpus size: 666,001 papers, 333,001
authors, 333 venues, 666 topics. Five million costs 82.9 s of `fossil run` for 38.2M edges and 430 MB
on disk.

### What survives, unchanged

| | 200k | 1M | 5M | single-type, for comparison |
|---|---|---|---|---|
| `Paper` mean runs | 153.6 | 166.8 | 200.8 | 170 / 142 / 169 / 248 |
| `Author` mean runs | 161.2 | 155.6 | 148.4 | — |
| vertex over-read, both types | **1.0000×** | **1.0000×** | **1.0000×** | 1.0000× |
| `Paper` edges fetched | 86,408 | 71,411 | 75,295 | 139,970 / 160,775 / 129,466 |
| `Author` edges fetched | 64,650 | 57,346 | 53,585 | — |

`corpus/measure-runs.mjs`, five windows of 20,000 vertices sized by rank, unchanged except that
`--type` and `--edge` now name the type instead of hard-coding `Node` — `dense_id` is per type, so a
run is a property of one type's numbering and means nothing across two. With no flags every recorded
number above reproduces.

**Over-read is still exactly 1.0000×, runs still sit in the low hundreds, and edges fetched is still
flat in N.** Three of the four claims transfer to a corpus family that shares nothing with the one
they were measured on.

**The 135–145k is not a law, though — it is this corpus's degree.** The knowledge graph fetches
53–86k for the same 20,000-vertex window because its self-edges are sparser (mean degree 8 and 6
against 14). What is a claim about the architecture is that the number does not follow N; the
magnitude belongs to the corpus, and quoting 135–145k as a property of the design would be quoting a
generator parameter.

### What does not survive: cross-type edges are never drawable

`corpus/measure-types.mjs`, two window centres drawn **per type** so the small types are looked at
even though they are a thousandth of the corpus. Of every edge leaving a window's vertices, how many
land back inside it:

| | self edges inside | cross-type edges inside |
|---|---|---|
| 200k | 512,367 / 558,224 — **91.8%** | 0 / 240,000 — **0.00%** |
| 1M | 330,138 / 363,379 — **90.9%** | 0 / 240,000 — **0.00%** |
| 5M | 265,546 / 290,067 — **91.6%** | 0 / 240,000 — **0.00%** |

**Zero. Not low — zero, at every size, over every window.** A window that holds a paper never holds
one single author, venue or topic that paper points at.

The lengths say why, in the layout's own units:

| 5M | median length | p90 | as a fraction of the union's 4,524,856 width |
|---|---|---|---|
| `Paper_cites_Paper` (self) | 130 | 67,902 | 0.003% |
| `Author_coauthoredWith_Author` (self) | 95 | 23,632 | 0.002% |
| `Paper_authoredBy_Author` (**cross**) | 2,314,575 | 3,289,940 | **51%** |
| `Paper_publishedIn_Venue` (**cross**) | 3,401,525 | 4,379,704 | **75%** |
| `Paper_hasTopic_Topic` (**cross**) | 3,408,946 | 4,387,258 | **75%** |

A cross-type edge is **~26,000× the median self-edge** and spans half to three quarters of the entire
layout. A 20,000-vertex window at five million is 76,571 half-width, so the median cross-type edge is
**thirty window-widths long**. This is not a tail: the *minimum* possible cross-type length is the
gap between two type blocks, so every one of them is long by construction.

**And the corpus was built to make this as easy as possible.** The generator aligns communities
across types, so the endpoints of every cross-type edge are semantically as close as a generator can
put them. The distance is entirely `place_after`: `VertexLayoutTarget::self_edge_csr` filters
adjacencies to `src_type == dst_type`, so the three cross relations are not in the layout's input at
all, and `place_after` then slides each type clear of the last with a 200-unit gutter. The doc comment
on it is honest about the trade — *"separated is wrong in a way a reader can see and reason about;
overlapped is wrong in a way that looks like data"* — and it is the right call. It is also, measured,
a graph in which **no cross-type edge can ever be drawn from a window**, which the design had not
said out loud.

**So drawing a neighbourhood is not one fetch.** "The papers by this author" is a second window, at a
distance of half the corpus, in another type's `dense_id` space and another set of files. Everything
above about a window being a bounded, contiguous, addressable thing is true *per type*, and says
nothing about the join between two.

### `place_after` wastes a sixth of the space, and it is not the gutter

The 200-unit `TYPE_GUTTER` is a rounding error. What costs is that each type is laid out into its own
Morton grid of clusters, of its own aspect, and the blocks are then put in a **row**:

| | union bbox | Σ of the types' own bboxes | empty |
|---|---|---|---|
| 200k | 33,433,403,392 | 31,224,725,776 | **6.6%** |
| 1M | 573,398,056,960 | 519,055,289,504 | **9.5%** |
| 5M | 6,818,307,768,320 | 5,658,051,423,648 | **17.0%** |

At five million, `Paper` is 3,016,341 × 1,506,856 and `Author` is 1,492,428 × 745,589 — half the
height. The union's height is the tallest block's, so the empty region is the band above `Author`,
1,492,428 × 761,267, which is 16.7% of the total. **The gutter is the aspect mismatch, not the gap**,
and it grows with N: 6.6 → 9.5 → 17.0% over twenty-five times the corpus, because each block's aspect
depends on how its cluster count falls against a power-of-two Morton grid. Nothing bounds it.

This is emptiness *between* type bounding boxes only. `cluster_layout` leaves its own space inside
each block, so 17.0% is a lower bound on what the multi-type layout wastes, not an estimate of it.

**Where it bites is a window sized by rank.** At five million, a window centred on a `Topic`:

| centre | half-width | what it holds |
|---|---|---|
| `Paper` | 76,571 | Paper 20,000 |
| `Author` | 38,034–42,334 | Author 20,000 |
| `Topic` | **172,258–177,838** | Author 15,005, Topic 3,330, Venue 1,665 |
| `Venue` | **169,546–173,667** | Author 15,005, Topic 3,330, Venue 1,665 |

A window on a small type has to open **4.5× as wide** to find 20,000 vertices, swallows the whole of
both small types, and fills the remaining 75% with `Author` — a type it has no edge to. It never
reaches a `Paper`, and the papers about that topic are 3.4M units away. The rank-sized window is
still the right definition; it is the layout that has nothing useful within reach of a sparse type.

### What the multi-type case does to the tile unit

The per-type arithmetic is unchanged. `corpus/measure-requests.mjs` — same harness, now taking
`--dir`, `--type`, `--edge` and `--rows` because the directory is named for the corpus and the chunk
list follows the type — over `Paper` at five million, vertex tiles carrying only the drawing columns:

| T | tiles touched | req/tile | requests | bytes/tile | vertex bytes | over-read |
|---|---|---|---|---|---|---|
| 1,024 | 38.3 | 3.0 | 115 | 18.6 kB | 0.70 MB | 4.05× |
| 2,048 | 24.3 | 3.0 | 73 | 34.9 kB | 0.83 MB | 4.83× |
| **4,096** | 16.2 | 4.0 | **65** | 36.7 kB | 0.58 MB | 3.37× |
| 8,192 | 9.8 | 4.0 | 39 | 75.6 kB | 0.73 MB | 4.22× |
| 32,768 | 4.5 | 4.0 | 18 | 287.4 kB | 1.26 MB | 7.34× |
| 122,880 | 2.0 | 4.0 | 8 | 1,094.4 kB | 2.14 MB | 12.43× |

Sixteen tiles touched at 4,096 against the single-type corpus's thirteen, the same monotone request
curve, the same flat-bottomed byte curve. **4,096 survives as the unit**, and the choice inside
1,024–8,192 is still not load-bearing.

Three things change, and none of them is the number:

**A tile is now per (type, relation), and small types are smaller than one tile.** At five million,
`Venue` is 1,665 rows and `Topic` is 3,330 — both under 4,096. For them the tile stops being a
granularity and becomes *the whole type in one file*. Any address arithmetic that assumes a type has
more than one tile is wrong on half the types in an ordinary knowledge graph.

**The metadata cost multiplies by the type and relation count.** The `3·files + 1` law above is
linear in files, and a multi-type corpus has more of them at the same corpus size: KG-1M is 11 vertex
chunks (`Paper` 6, `Author` 3, `Venue` 1, `Topic` 1) plus 5 edge files = **16**, against the
single-type 1M's 9 + 1 = **10**. Same million vertices, 1.6× the per-slice metadata — and three of
those five relations return nothing a window can draw.

**Reading one type is cheaper than reading the corpus, and that is not a saving.** `Paper` at five
million costs 133.0 requests and 6.26 MB per cold window against the single-type 5M's 208.3 and
12.12 MB, because `Paper` is 3.33M rows and not 5M. A reader that wants the *graph* pays for every
type it touches.

### What this cannot prove

- **Nothing here is timed.** Runs, over-read, tiles, requests and bytes — no milliseconds, no
  browser. The 0.00% cross-type retention is a statement about what a window contains, and what it
  costs to draw a cross-type edge anyway is unmeasured.
- **One knowledge-graph shape.** Four types, one hub. A corpus with two comparably-sized types and a
  dense bipartite relation between them would stress `place_after` differently, and a corpus whose
  types are all the same size would show a smaller gutter than 17% by construction.
- **The reader is still one type at a time.** `measure-requests.mjs` opens one type's chunk list; the
  16-file figure above is arithmetic over the manifest, not a measured union query. The cost of a
  reader that opens all four types at once is unmeasured.
- **The writer's memory was not captured** for this family — the `time -l` output was filtered away
  by the run that produced these corpora, and it has not been re-run.
- **`in` and `on` are keywords, and the error does not say so.** `kg:in = ...` passes `fossil check`
  and dies in `fossil run` with `Projections require unique expression names but the expression
  "?table?.community AS community" at position 1 and ... at position 2 have the same name` — a
  DataFusion planning error naming a column that has nothing to do with it. It cost four bisections
  of `kg.fossil` to find. Renaming the property is the whole fix, and the message is worth a
  fossil-side issue.

## The last harness run, verbatim

Machine-owned. `run-bench.mjs` overwrites everything between the two markers below and nothing
outside them, so this is raw output waiting to be read — not a section to edit, and not one to
trust over the dated layers above until someone has folded it in.

<!-- run:start -->
_No run recorded since the runner stopped owning this file._
<!-- run:end -->
