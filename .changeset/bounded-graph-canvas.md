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

**A vertex is `vertexId(type, dense)`, and a buffer index is not one.** cosmos.gl addresses points by
their position in the arrays it was last handed, so an answer that comes and goes reuses every index
while the vertices behind them change. `Slice.ids: Uint32Array` is now `Slice.vertices: Float64Array`
carrying that pair packed — the pair rather than the dense id because `dense_id` numbers *within one
vertex type*, so a union of two types repeats every value. `useBoundedGraph` returns a `Resident`
alongside each answer (`indexOf` / `at` / `indicesOf` / `verticesAt`), and that is the only map:
build a second and it is the same value one render later with no way to notice it has fallen behind
the buffers on screen.

What this changes for a call site:

- `Selection.ids: number[]` → `Selection.vertices: VertexId[]`, and `GraphCommands.reveal` takes one.
- `useGraphSelection` takes `getResident` where it took `getSlice`, and commits a `Set<VertexId>`.
- `useGraphOverlays(getGraph)` → `useGraphOverlays({ getGraph, getResident })`, and `labelRef`,
  `setLabelOrder` and `setHovered` all take identities. A label whose vertex is not in the current
  answer hides rather than following the index.
- `duckBoundedSource` requires `typeIndex`, with no default: the source is the only thing that knows
  which relation a dense id came from, and a defaulted `0` would let a second relation ship the same
  identities as the first. `MemoryGraph.ids` is `MemoryGraph.vertices: Float64Array` for the same
  reason. `denseOf(vertex)` is the way back down to SQL.
- A super-node wears the reserved `SUPERNODE` type. An aggregate numbers its groups `0..k`; left in
  the corpus' own type, group 3 and vertex 3 were one identity, so a selection made zoomed out came
  back on the way in pointing at three arbitrary nodes.

Four further consequences worth reading before upgrading:

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
