---
"@kanzo-tech/graph": major
"@kanzo-tech/ui": minor
---

**The canvas stops holding the graph and asks instead — `load()` and `Loaded` are deleted.** Per
ADR-0001. `load()` read a node relation and an edge relation whole: every id, every row, an id→index
`Map`, a global ranking by size. The working set was N, so the ceiling was whatever N the machine
could hold — 1,225 ms of first paint at 200,000 nodes, and not viable short of a million. The
bounded alternative measures 105 ms at the same size and 30 ms per camera move, and its first paint
follows the window rather than the corpus.

`useBoundedGraph(options)` is the query loop: it asks `total()` first, observes the camera, debounces
at 120 ms, aborts what the camera has already superseded, and pushes each answer's geometry into the
renderer. Under the limit a source is asked once for everything and never again, so panning stays
free exactly when it can be. `memorySource(graph)` wraps arrays a host already holds and is the only
source here that answers both a rectangle **and** a neighbourhood; `duckBoundedSource(options)` moved
up from the benchmark onto `@kanzo-tech/graph/duckdb`, a subpath because Mosaic is an optional peer
and that is the half needing it.

Four consequences worth reading before upgrading:

- **A category is an ordinal, never a name.** A `Slice` carries `Uint16Array` category codes, so
  `buffers(slice, look, host)` and `scaleOf(look, capacity)` take ordinals. What an ordinal is
  *called* is a legend's question, and the ordinal is whatever the source ranked the column into — a
  call site mapping names to ordinals must sort its domain the same way, or the legend names colours
  the canvas gives to something else.
- **The label budget lost its global ordering.** `ranked` sorted the corpus once; a slice knows only
  its own points, so importance became a property of the answer — the biggest nodes *here*.
- **The simulation is off by default.** Positions are authority: a bounded source hands back the
  coordinates the next spatial query is expressed in, so a force that moves them moves the picture
  out from under its own index. `simulate: true` is for the host with arrays and no layout.
- **`useCosmosGraph` no longer takes data**, and construction no longer depends on it. Keyed on a
  slice it would tear down and rebuild a WebGL context on every camera move.

`viewportOf` is gone with it — cosmos.gl owns the screen↔space transform and answers it through
`screenToSpacePosition`, so deriving the rectangle from the camera and the space size was a second
implementation free to drift from the renderer's own maths.

`adaptive(nodeCount)` arrives from `@fossil-lang/viewer`'s `getAdaptiveConfig` per ADR-0040, which
files it under level-of-detail policy. It mostly is not: almost all of it is simulation tuning, so it
applies under `simulate: true` — level of detail in the bounded sense is `lodThreshold` and a
source's aggregate mode, a different mechanism. The continuous interpolation is kept because
breakpoints snap, and `spaceSize` is deliberately dropped: the original scaled the box with the
corpus, which is incoherent once positions are authority, because the box is the coordinate space a
spatial query is asked against.

`@kanzo-tech/ui/analytics` gains `fillColumn(data, field, into, offset, stride)`. `numbers()` is the
wrong tool once a result is large: Arrow already hands back a typed buffer, and
`Array.from(...).map(Number)` turns it into two full-length boxed arrays on the way to a third that
was the actual destination — three copies to move nothing. `fillColumn` is the same pass with none of
them, and `offset`/`stride` are how interleaving is expressed, so `x` and `y` fill one
`[x0, y0, x1, y1, …]` buffer with no seam and no intermediate.
