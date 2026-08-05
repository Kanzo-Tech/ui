# The graph, both halves

One roadmap for two repositories, because the work is one system split by language rather than by
concern: `rmlext` writes the corpus and `kanzo-ui` reads it, and almost every open question needs a
measurement from one side to answer a design question on the other. Items are tagged **fossil** or
**canvas** by where the code lives, and the tag is *not* a sequence — the point of writing them
together is that most of them run at the same time.

Measured 2026-08-05. Numbers here are from `BENCHMARKS.md`; if the two disagree, that file wins.

## Settled earlier, and worth not re-deriving

**Vertex over-read is exactly 1.0000×** at 200k, 1M, 5M and 10M. Not "near zero" — a 20,000-vertex
window covers exactly 20,000 ids, every window, every size.

**Edges fetched per window is flat:** 135–145k across fifty times the corpus. This is the term that
dominates the scan, and it does not follow N. The reduction against the whole edge table is 9.8× at
200k and 482.7× at 10M, which grows only because the denominator does. **Flat is the claim; 135–145k
is not** — the knowledge-graph family (item 6.1) is flat at 53–86k, because the magnitude is the
corpus's mean degree.

**Run count is bounded but not proven flat:** 176 / 184 / 262 at 1M / 5M / 10M, twenty windows. Four
points cannot separate growth from the corpus family's own uneven density — the layout's width goes
208k → 646k → 5.29M → 8.09M, so a window fixed by *vertex count* covers different areas at different
sizes.

**The runs are the space-filling curve, not the communities.** ADR-0042 §3 says a community is a
compact disc and a window holds whole communities. At five million, `community` has eight groups of
625,000 each shattered into 5,461 id runs, and `cluster_id` has 15,310 groups whose **median size is
one vertex**. A window of ~170 runs of ~118 ids is neither. A rectangle over a Morton order maps to
O(√n) segments; that is the whole mechanism.

**Writing ten million peaks at 16.4 GiB** for a 713 MB corpus, 262.6 s. Twenty-three times the
output, resident.

## Settled 2026-08-05 — the one that blocked tile sizing

### 1. Requests and bytes per pan — **canvas**, measured; the emitter is unblocked

`corpus/measure-requests.mjs` serves the corpus over a plain HTTP origin, logs every request the
server answers, and runs `detail()` verbatim. Full numbers and caveats in `BENCHMARKS.md`.

**Arriving at a window costs 17 / 55 / 208 / 376 requests and 2.4 / 5.4 / 12.1 / 13.1 MB** at 200k /
1M / 5M / 10M, against an ideal payload that is **flat at 0.6–0.9 MB**. Over-read peaks at 18.9× at
five million.

**The fear was the wrong one.** 169 ranges per window is not what the reader issues. It issues
`3·chunks + 1` HEADs and one 16,384-byte footer read per chunk *in the corpus*, needed or not — the
law holds exactly at every size (7, 28, 124, 247 for 2, 9, 41, 82 chunks). **Request count is linear
in N and it is all metadata**; at ten million, 85 of ~129 body-carrying requests per window are
footers of chunks the window never touches, and a cached drag step still costs 247 requests to
transfer zero bytes.

**The tile size, measured both curves.** Tiles touched is exact from the window's ids; the cost of a
tile is measured by writing real ones. At five million, with vertex tiles carrying only the drawing
columns and edge tiles keyed by source range:

| T | requests | bytes | vs ideal |
|---|---|---|---|
| 1,024 | 178 | 1.11 MB | 1.73× |
| 4,096 | **78** | 1.48 MB | 2.31× |
| 8,192 | 47 | 1.89 MB | 2.95× |
| 32,768 | 25 | 4.61 MB | 7.20× |
| 122,880 (today's chunk) | 35 | 11.73 MB | 18.3× |
| today, as the corpus stands | 208 | 12.12 MB | 18.9× |

**122,880 is Pareto-dominated by 32,768** — more requests *and* four times the bytes, because a
122,880-row edge tile spans several row groups and costs 9.4 requests. Every size in the table beats
the corpus as it stands on both axes.

**Bytes bottom out at 1,024–2,048 and requests fall monotonically, so the curves have no common
optimum.** The choice is `λ·β`, the bytes a link moves in one request's latency: serial → 32,768;
six in flight → 8,192; fully multiplexed → **4,096**. A tile reader computes every URL before it
issues the first, which is the whole content of *addressed, not queried*, so **4,096 rows** is the
unit — and the byte curve is flat from 1,024 to 8,192, so the emitter must not be tuned inside that
band.

**One free finding for item 5:** a tile carrying only `dense_id, x, y, community` costs 3 requests
and 36.0 kB against 4 requests and 37.0 kB (of 68.8 kB stored) for the full six columns. Same bytes
on the wire, one less round trip, half the storage. The properties want a sidecar.

## Open

### 2. Rewrite ADR-0042 §3 — **canvas**, unblocked, cheap

§3 ("una tesela es una comunidad") has lost its premise, above. The finding it rests on survives and
is stronger than when it was written; the pyramid built on it does not follow. Two things to settle
on paper:

- **Where an edge lives.** §2 keeps "align edges to the source chunk" (CSR) as an internal
  invariant and §3 says an edge lives in the deepest tile containing both endpoints (LCA). These are
  different placements. CSR is what the measurements describe — reading the window's runs yields
  every drawable edge with 1.1–1.3× over-read and no second fetch. LCA pushes cross-community edges
  up and makes the root accumulate a set that grows with N, which is the non-flat term reappearing.
- **What a tile is.** Item 1 now fixes the unit — a `dense_id` range of **4,096 rows**, vertices and
  edges keyed by the same range — so what is left on paper is the tree above it and whether there is
  one at all. Note that the measurement also removes the last argument for `chunk_size` 122,880: it
  is dominated by 32,768 on requests *and* bytes.

### 3. Selection and overlays by identity — **canvas**, done 2026-08-05

ADR-0042's own "risk that bites first", and it is closed. A vertex is `vertexId(type, dense)` packed
into one number; `Slice.ids` is `Slice.vertices: Float64Array` of those; and the identity↔index map
is a `Resident` that `useBoundedGraph` rebuilds with every answer — **there, because that is where
residency changes**, and a copy built beside it is the same value one render later with no way to
notice it has fallen behind the buffers. Selection, overlays, pins, the focus ring and the greyout
all resolve through that one map.

Measured live, over the workspace showcase with its limit forced to 120 so the 1,543-node corpus is
actually sliced. A marquee selection of 13 held `highlightedPointIndices`
`[0,1,2,3,8,15,16,18,22,32,34,35,37]` in a 76-point answer, **0** after panning to a 25-point answer
holding none of them, and `[0,1,2,3,7,12,13,15,19,26,28,29,30]` in a 32-point answer holding all
thirteen — nine at a different index, four of the originals past the end of the buffer, the selection
itself never touched. `reveal` on a vertex the camera had left behind pinned it, the next answer
carried it, and the second press landed on that vertex by name.

**Two things it turned up that were not in the brief.** An aggregate numbers its super-nodes `0..k`,
so zoomed out they were wearing the corpus' own identities — group 3 *was* vertex 3, and a selection
made zoomed out came back on the way in pointing at arbitrary nodes; they take a reserved type now.
And `duckBoundedSource` was filtering the pinned set with no idea whose ids they were, which is a
wrong-rows bug the moment a second relation joins the canvas; `typeIndex` is required, with no
default, for that reason.

### 4. Isolate the writer's memory — **fossil**, started, and the suspect was wrong

`crates/fossil-runtime/examples/layout_memory.rs` (rmlext `107b8e5`) isolates the layout core — no
I/O, no DuckDB, a planted-partition graph, RSS sampled *while* `community_hierarchy` runs:

| n | edges | peak RSS | per edge | time |
|---|---|---|---|---|
| 5M | 34.8M | 1.93 GiB | ~53 B | 40.4 s |
| 10M | 69.5M | 3.94 GiB | ~53 B | 92.7 s |

**Linear in edges, and a quarter of the total.** Louvain does hold the graph in memory and it does
scale — but at ten million it is 3.94 of the build's 16.4 GiB. ADR-0042 predicted the risk was
here; it is here, and it is not the majority of it.

Sampling matters: read *after* the call, the same 5M run reports 1.03 GiB, so measuring the
survivor would have halved the figure and exonerated the contraction step.

**Located, and it is none of the candidates.** `FOSSIL_LAYOUT_PROBE=1` (rmlext `4cefe46`) reports
resident set per phase of `enrich_layout` at ten million:

    start                                      14.61G
    read edges into Vec                1.6     11.50G     -3.12G
    community_hierarchy              132.5     13.87G     +2.37G
    …
    total                            139.2     14.74G  peak 14.74G

**RSS is 14.61 GiB before the layout pass runs a statement**, and the whole pass adds 0.13 GiB net.
The process peak is reached earlier still. Reading 71M edges into a `Vec` shows *minus* 3.12 GiB —
the ingest releasing buffers faster than the vector grows.

The cost is **W0b**: parsing 1.2 GB of CSV and writing the vertex and edge Parquet. Louvain is
132.5 of the 139 seconds, so it dominates *time* and is nearly free in *space* against what
precedes it — the opposite of what ADR-0042 predicted.

Eliminated by measurement on the way here, each of which looked right at the time: the
per-community `HashMap`s in `contract`; the layout core as the dominant term (3.94 GiB isolated);
DuckDB during layout (bounded to 2 GB, total unchanged, spill directory untouched at 0 B); and the
Node generator (`fossil run` alone reaches the same peak).

**Attributed 2026-08-05, and closed.** The probe moved down to `fossil-base` (rmlext `d52b6c5`) so
`fossil-df` could carry it, and reports per phase of the write path. The corpus that `execute_graph`
hands to the writer is **1.64 GiB of Arrow** while the process holds **15.68 GiB** — so the fourteen
were never the data. Dropping the executor's context frees 0.00 GiB, and the same phase measured
+7.67 GiB on one run and +11.35 GiB on the next.

They are DataFusion operator memory, unbounded by construction. Under `FOSSIL_DF_MEM_GIB=4` the
vertex sort spills to 3.02 GiB and the edge phase dies, with the pool naming it:
`HashJoinInput[8](can spill: false)`, one reservation per partition. A hash join's build side cannot
give anything back; a sort-merge join can. With both, ten million peaks at **9.87 GiB instead of ~21,
for 13% of the clock, and writes a byte-identical corpus** (87 files, every md5 equal). Full numbers
in `BENCHMARKS.md`; the decision is rmlext ADR-0043 stage 4.

**What this leaves — and it is less than it sounds.** The same budget at 1M and 10M peaks at 2.43
and 9.87 GiB: ten times the corpus, four times the peak, with the retained Arrow exactly linear
(0.16 → 1.64 GiB). The pool caps the executor and nothing else, and three terms outside it grow with
N — `GraphArData` holding every batch before a byte is written, `to_files()` encoding every Parquet
before touching disk, and the layout pass reading the whole edge list into a `Vec`. All three are the
same shape: a stage boundary that is a whole value rather than a stream. The engine streams; our
seams collect.

So item 6.3 is testable rather than blocked, but the honest claim is only that **the write path can
now be given a budget it will honour**. Still owed on the fossil side: the budget as a `run` input
rather than an environment variable, a test that demands a spill, and the three seams above —
`to_files` as an iterator is the cheap one, ADR-0043 stages 1 and 6 are the other two.

### 5. The tile payload format — **fossil** ✕ **canvas**, blocked by 2 only

Unstated in the ADR and it decides whether "addressing" removes work or moves it. §1 says no DuckDB
in the drawing path and §3 says `x`/`y` upload to the GPU untransformed — Parquet gives neither
without a decoder (dictionary, RLE, snappy, page headers). Arrow IPC buffers are already contiguous
typed arrays. Parquet stays the corpus and interchange format; the *tile* is a separate decision.

Item 1 measured one edge of it: a Parquet tile costs **3 requests** — HEAD, footer, one coalesced
data range — and that number is a property of the format, not of the tile size. A format needing no
footer would make it one, which is a third of the request curve above gone before any size is chosen.

### 6. Three demos — **fossil** ✕ **canvas**, in this order

From ADR-0042. #1 is measured, #3 has started:

1. **Knowledge graph** — **done 2026-08-05, and it refutes something.** `kg.fossil` +
   `corpus/build-kg-corpus.mjs`: four vertex types, five edge types, three of them crossing types,
   at 200k / 1M / 5M total vertices, written by fossil at rmlext `995bdad` (the tip, `8484b7e`, does
   not compile). Full numbers in `BENCHMARKS.md`.

   **Three of the four claims transfer.** Vertex over-read is **1.0000×** at every size and both
   large types; runs stay in the low hundreds (148–201 against the single-type family's 142–248);
   edges fetched per window is flat in N. The 135–145k figure itself does not transfer and should
   not be quoted as one — this family fetches 53–86k for the same 20,000-vertex window because its
   self-edges are sparser. Flatness is the claim; the magnitude is a generator parameter.

   **What is refuted: a cross-type edge is never drawable from a window.** Of 240,000 cross-type
   edges leaving the windows, **0 land inside — 0.00%, every size, every window** — against 91% for
   self-edges. The median cross-type edge at five million is 2.3M–3.4M long against a self-edge's
   95–130, which is half to three quarters of the whole layout and **thirty window-widths**. The
   corpus was generated with communities aligned across types, so this is `place_after` and not the
   data: cross-type adjacencies are filtered out of the layout's input by `self_edge_csr`, and each
   type is then slid clear of the last. Drawing "the papers by this author" is a second window in
   another type's `dense_id` space, half a corpus away.

   **`place_after` wastes 6.6 / 9.5 / 17.0% of the bounding box** at 200k / 1M / 5M, and it is not
   the 200-unit gutter — it is the aspect mismatch of putting blocks of different heights in a row.
   Nothing bounds it, and it grows with N. A window sized by rank centred on a small type opens
   **4.5× as wide**, swallows both small types whole and fills the rest with a type it has no edge to.

   **The tile unit holds at 4,096** — 16.2 tiles touched at five million against the single-type
   corpus's 13.0, same monotone request curve, same flat-bottomed byte curve. What changes is that a
   tile is per *(type, relation)*; that `Venue` (1,665 rows) and `Topic` (3,330) are **smaller than
   one tile**, so address arithmetic assuming a type has more than one is wrong on half the types;
   and that the `3·files + 1` metadata law now counts 16 files at KG-1M against 10 for a single-type
   million, three of whose relations return nothing a window can draw.

   **Left open by it:** whether the layout should take cross-type edges as input at all (the
   `.planning/W3-LAYOUT-PLAN.md` §5 slice), and what a reader that opens every type at once costs —
   the 16-file figure is arithmetic over the manifest, not a measured union query. Nothing here is
   timed.

2. **Map with lat/lon**, which forces given positions to be the normal branch and checks that the
   tile tree comes out the same over given positions as over computed ones.
3. **Larger-than-RAM** — item 4 is its first measurement.

## Housekeeping, both repos

**`crates/fossil-codegen/` breaks the workspace** — **fossil**. Two JSON fixtures, no `Cargo.toml`,
no sources, and `members = ["crates/*"]` picks it up, so `cargo build` fails outright for anyone.
Set aside to build on 2026-08-04 and restored untouched. Somebody has to say whether it is debris or
a crate in flight.

**The tip does not compile, and a corpus build is how you find out** — **fossil**. rmlext `8484b7e`
leaves `pub mod lineage;` in `fossil-ide/src/lib.rs` for a file `dfd46fe` moved to `fossil-registry`,
so `cargo build -p fossil-cli` fails outright. Item 6.1 was built from `995bdad` instead, whose
`layout.rs` and `fossil-engine` are identical.

**`in` and `on` are keywords and the error blames a column** — **fossil**. `kg:in = …` passes
`fossil check` and dies in `fossil run` with a DataFusion `Projections require unique expression
names` error naming `community`, which is not involved. Four bisections to find; renaming the
property is the whole fix.

**The built binary falls behind in silence** — **fossil** or **canvas**, either end. A corpus built
on 2026-08-04 came out unordered because `target/release/fossil` was from 1 August and the Morton
renumbering landed on the 3rd (`c678e63`). It cost a full measurement and looked exactly like the
premise failing. `build-corpus.mjs` should refuse, or at least warn, when the binary it is about to
invoke predates the last commit touching the layout.
