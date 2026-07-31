# ADR 0001: The canvas stops holding the graph, and asks instead

**Date:** 2026-07-31
**Status:** proposed
**Decider:** Ángel Iglesias (Kanzo)
**Cite:** `BENCHMARKS.md` (three measured layers, 2026-07-31); `rmlext/decisions/0040-remove-ui-from-fossil.md` (fossil exposes protocols only); `rmlext/decisions/0039-fossil-graph-surface.md` (the fourteen verbs; "Serverless · Larger-than-RAM · Chunking"); `DESIGN.md` (admission rules; the presentational-plus-engine split).

## Context

`GraphCanvas` holds the whole graph. `load()` reads a node relation and an edge
relation into a `Loaded` — every id, every row, an id→index `Map`, a global
ranking by size — and everything after that is an in-memory lookup: the hover card
reads `rows[i]`, the inspector reads `rows`, the label budget spends from `ranked`,
search filters `rows`, and selection is expressed in array indices.

Measured on an M4 Pro, that costs 1,225 ms of first paint at 200,000 nodes and
stops being viable short of a million. The bounded alternative — ask for what is
visible, capped — costs **105 ms at the same size, and 30 ms per camera move**,
and its first paint stops scaling with the corpus: four times the nodes costs 36%
more rather than 400%. ADR-0039 in fossil names the pattern we currently use as
the one that tops out near a million vertices, and asks for the opposite: wire
transport, working set and render path all bounded.

Three things that looked like separate problems turn out to be one.

- **fossil should ship no UI** (ADR-0040), because interfaces are not its business.
- **The canvas should not hold the corpus**, because holding it is the ceiling.
- **fossil already exposes exactly what a canvas that does not hold the corpus
  would need to ask** — `find_neighbors`, `search_by_label`, `describe_field`,
  `viewport`.

They are one boundary seen from three sides. A canvas that asks instead of holding
is a *client of a protocol*, which is precisely what ADR-0040 leaves fossil
exposing. The alternative reading — that a canvas needs its own data access,
separate from the verb surface — would recreate in this repository the duplication
ADR-0040 exists to remove.

The costs are real and were weighed. Bounded rendering introduces a per-pan query
where there was none; it makes a hover card wait for an answer that used to be a
property lookup; and it destroys the two things a whole-corpus view gets for free —
a stable index per node, and a global ordering to spend a label budget from.

## Decision

We will make the canvas a client of a bounded source, and delete the path that
holds everything.

**A hook owns the query loop.** `useBoundedGraph(source, options)` observes the
camera, debounces, cancels superseded requests, reconciles the answer into the
renderer, and returns state. The canvas stays presentational. This is the split
`DESIGN.md` already requires of anything with an engine — *"a component that needs
an engine is the presentational one plus the engine — two components"* — and it
keeps the canvas usable by a host that already has its arrays.

**`load()` and `Loaded` are deleted, not deprecated.** `shouldSlice` already covers
the small case: under the limit, take one slice that covers everything and never
ask again, so panning stays free exactly when it can be. One path, per the repo's
standing rule against shims and parallel routes. The cost is a single large
rewrite of the canvas rather than a gradual one, and we accept it.

**Detail is fetched, not carried.** A slice is geometry: positions, links,
categories, ids. A hover asks for one node's detail, debounced; the inspector asks
for what it shows. This is what the verb surface is for, and it keeps a slice from
paying to carry twenty thousand labels of which a reader will see three.

**Identity is an id, never an index.** Slice indices do not survive a slice.
Selection, focus and pinned sets are held as source ids and re-resolved on each
answer, and a selection's *size* comes from the query rather than from what is
currently drawn — a selected node outside the viewport is still selected.

## Consequences

**What becomes easier**

The ceiling stops existing. First paint follows the window rather than the corpus,
so a ten-million-node graph opens in about the time a two-hundred-thousand-node one
does, and the machine is never asked to hold what it is not showing.

Every question the canvas asks becomes a question something else already answers.
The hover card, the inspector and search stop being private in-memory features and
become calls — which means an agent over MCP, a CLI and the canvas all reach the
same answers through the same surface, and none of them re-derives it.

**What becomes harder**

A hover card that used to be instantaneous now waits. Debounced and against an
in-tab WASM query that is brief, but it is not zero and it is the one user-visible
regression here.

The label budget loses its global ordering. `ranked` sorted the whole corpus once;
a slice knows only its own points, so "the most important labels" becomes a
property of the query (`ORDER BY … LIMIT` inside the slice) rather than of a
precomputed array. That is arguably more correct — the most important nodes *here*
is a better question than the most important nodes anywhere — but it is a
different answer and some views will notice.

Every consumer needs a source. A host with arrays in hand must wrap them in the
trivial in-memory implementation rather than calling `load()`; that implementation
is small, but it has to exist and it has to be written once, by us.

**New risks**

*Layout ownership is unresolved and this decision does not resolve it.* Positions
arrive precomputed, which puts a visual judgement — how communities separate, how
much a graph breathes — in a batch job upstream, and leaves filtering broken: a
subset keeps coordinates computed for the whole and reads as scattered with holes.
There is a resolution available *because* the path is bounded — a slice is at most
20,000 points, and the engine layer measures those at 10 ms a simulation step, so a
slice is small enough to re-lay-out live — but nothing implements it and it is not
decided here.

*A source that cannot answer neighbourhoods limits exploration to panning.*
`SliceQuery` has both shapes and `supports()` lets a source refuse honestly, but the
DuckDB source we measured with answers regions only. Until a neighbourhood source
exists, the bounded canvas is a map and not yet an explorer.

*The measurements behind this are on an in-memory DuckDB table.* The
larger-than-RAM half — Parquet over range requests, with row-groups skipped by a
spatially ordered file — is not measured, and depends on Morton ordering that
fossil tracks as W3. What is proven here is that bounding beats materialising; what
is not proven is how cheap the bounded query stays when the bytes are remote.
