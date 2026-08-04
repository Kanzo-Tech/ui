# The graph, both halves

One roadmap for two repositories, because the work is one system split by language rather than by
concern: `rmlext` writes the corpus and `kanzo-ui` reads it, and almost every open question needs a
measurement from one side to answer a design question on the other. Items are tagged **fossil** or
**canvas** by where the code lives, and the tag is *not* a sequence — the point of writing them
together is that most of them run at the same time.

Measured 2026-08-04. Numbers here are from `BENCHMARKS.md`; if the two disagree, that file wins.

## Settled today, and worth not re-deriving

**Vertex over-read is exactly 1.0000×** at 200k, 1M, 5M and 10M. Not "near zero" — a 20,000-vertex
window covers exactly 20,000 ids, every window, every size.

**Edges fetched per window is flat:** 135–145k across fifty times the corpus. This is the term that
dominates the scan, and it does not follow N. The reduction against the whole edge table is 9.8× at
200k and 482.7× at 10M, which grows only because the denominator does.

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

## Open — and the one that blocks a design decision

### 1. Requests and bytes per pan — **canvas**, blocks tile sizing

The number that justifies tiles over range requests into one file, and it has never been measured.
169 ranges per window is 169 HTTP requests unless something coalesces them; multipart range replies
are barely supported, so a tile is really *a pre-coalesced run set* and its size is an arithmetic
problem, not a taste one. `measure-pan.mjs` already pans; it reports chunks and rows, and needs
requests and bytes.

Until this lands, **do not write the tile emitter** — its unit is exactly what this decides.

### 2. Rewrite ADR-0042 §3 — **canvas**, unblocked, cheap

§3 ("una tesela es una comunidad") has lost its premise, above. The finding it rests on survives and
is stronger than when it was written; the pyramid built on it does not follow. Two things to settle
on paper:

- **Where an edge lives.** §2 keeps "align edges to the source chunk" (CSR) as an internal
  invariant and §3 says an edge lives in the deepest tile containing both endpoints (LCA). These are
  different placements. CSR is what the measurements describe — reading the window's runs yields
  every drawable edge with 1.1–1.3× over-read and no second fetch. LCA pushes cross-community edges
  up and makes the root accumulate a set that grows with N, which is the non-flat term reappearing.
- **What a tile is**, given the above and item 1.

### 3. Selection and overlays by identity — **canvas**, unblocked, do early

ADR-0042's own "risk that bites first". `use-graph-selection.ts` and `use-graph-overlays.ts` work on
local indices into the current slice; a resident set that comes and goes makes that index unstable
while the identities stay valid. Verifiable **today**, against the current viewer, which is why it
goes before tiles rather than with them.

Note when doing it: cosmos.gl addresses points by buffer index, and `getConnectedLinkIndices` is
local-index based, so the identity↔index map is rebuilt per residency change.

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

**Next**: the same probe on the W0b write path, which is `fossil-engine`'s materialise rather than
this module. That is where the ~14 GiB is committed.

### 5. The tile payload format — **fossil** ✕ **canvas**, blocked by 1 and 2

Unstated in the ADR and it decides whether "addressing" removes work or moves it. §1 says no DuckDB
in the drawing path and §3 says `x`/`y` upload to the GPU untransformed — Parquet gives neither
without a decoder (dictionary, RLE, snappy, page headers). Arrow IPC buffers are already contiguous
typed arrays. Parquet stays the corpus and interchange format; the *tile* is a separate decision.

### 6. Three demos — **fossil** ✕ **canvas**, in this order

From ADR-0042, unchanged except that #3 has started:

1. **Knowledge graph**, first, because it can invalidate the design before anything is built on it.
   Everything measured so far is one vertex type and one edge type; `place_after` has never been
   exercised at scale and cross-type edges are excluded from layout by construction.
2. **Map with lat/lon**, which forces given positions to be the normal branch and checks that the
   tile tree comes out the same over given positions as over computed ones.
3. **Larger-than-RAM** — item 4 is its first measurement.

## Housekeeping, both repos

**`crates/fossil-codegen/` breaks the workspace** — **fossil**. Two JSON fixtures, no `Cargo.toml`,
no sources, and `members = ["crates/*"]` picks it up, so `cargo build` fails outright for anyone.
Set aside to build on 2026-08-04 and restored untouched. Somebody has to say whether it is debris or
a crate in flight.

**The built binary falls behind in silence** — **fossil** or **canvas**, either end. A corpus built
on 2026-08-04 came out unordered because `target/release/fossil` was from 1 August and the Morton
renumbering landed on the 3rd (`c678e63`). It cost a full measurement and looked exactly like the
premise failing. `build-corpus.mjs` should refuse, or at least warn, when the binary it is about to
invoke predates the last commit touching the layout.
