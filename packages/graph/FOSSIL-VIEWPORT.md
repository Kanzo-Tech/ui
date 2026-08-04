# `viewport`, from the consumer's side

What the graph canvas needs from fossil's `viewport` verb, and where the two designs already agree.
Everything here is backed by `BENCHMARKS.md` in this repo; nothing is a preference.

The context that makes this worth writing: `BoundedSource` is deliberately not a format, and
`duckBoundedSource` is one implementation of it over two plain relations. But keasy is the only
consumer and keasy is fossil, so **what the benchmark measures is what the verb will do** — and it
turns out that is literally true, not approximately.

## The two are the same query

`viewport_scan_sql` (`fossil-graph/src/exec.rs`) emits

```sql
SELECT dense_id, x, y, cluster_id, <idx>::UTINYINT AS type_idx FROM <Type>
WHERE x BETWEEN … AND … AND y BETWEEN … AND …
```

and `viewport_edges_sql` joins the numbered result twice against the whole edge table. That is,
shape for shape, what `duck-source.ts` issues. So every number in `BENCHMARKS.md` layer 4 is a
statement about the verb: 240 ms of first paint at a million, 1,006 ms at five million, a pan going
linear with N. **Routing the showcase through the verb would change nothing measurable.** It is a
refactor, not a fix.

## `viewport` is a composite verb, and the fix is not to split the RPC

It does five things: a spatial scan, a limit, a numbering, an induced-edge join, and a mode switch
on a zoom threshold. Two of those do not belong to a data engine at all — **`zoom` is a camera
concept**, and `lod_threshold` is a rendering policy. The host has the camera; it can ask for detail
or for aggregates. A verb that takes a float called `zoom` has one consumer in mind.

The rest decomposes into primitives that are worth having on their own:

- **`select_vertices(predicate, limit)`** — a bounding box is just a predicate. Generic over columns
  rather than special-cased on `x`/`y`, it is the same verb that answers "vertices where
  `community = 3`" or any facet a crossfilter produces.
- **`induced_edges(vertices)`** — the edges with *both* endpoints in a given vertex set. This is the
  induced subgraph, and it is the reusable primitive: the viewport needs it, neighbourhood expansion
  needs it, any export of a selection needs it. It is also the 35 ms of the 95 ms pan we measured,
  so it is worth being able to reason about alone.
- **`aggregate(group_by, …)`** — already a verb. Aggregate mode is `aggregate(cluster_id)` with
  centroids, not a second personality inside `viewport`.

**But splitting them into separate calls would be worse than the composite.** `induced_edges` needs
the vertex set, and that set is twenty thousand ids; sending it back down the wire between two calls
buys a round trip and a materialisation to save a join. That cost is exactly why the composite verb
exists, and it is a real reason rather than an oversight.

So the composability has to live in the **query**, not in the RPC surface: primitives that compose
into one plan and execute once.

```
select_vertices(within(bbox), limit: 20_000) |> with_induced_edges()
select_vertices(all) |> group_by(cluster_id) |> centroid()
```

One call, composable definition, no intermediate crosses the boundary. `viewport` then stops being
a verb and becomes a *named plan* a host may use — expressible, inspectable, and replaceable by a
host that wants a different one. That is the difference between a verb set that generalises to
another domain and one that grew a special case per consumer.

This is also what makes the columnar change coherent rather than local: if every primitive returns
Arrow and composes before execution, there is exactly one materialisation at the end, in the shape
the consumer uploads.

## What the two sides already agree on

Two of these were added to fossil while this note was being written — they are that work, not
independent convergence, and are recorded here so the seam has one description rather than two.

- **`n` separate from what is returned.** Both carry "how many matched before `limit` cut them",
  and both document the same reason: a truncated answer otherwise looks exactly like a complete one.
- **`lod_threshold` of 0.5**, and aggregate mode below it answering super-nodes by `cluster_id`. Our
  constant cites the verb's value explicitly so there is one number across the seam.
- **A dense id local to the answer.** `ViewportVertex.dense_id` is documented as "not the GraphAr
  dense id, which is ambiguous across vertex types and does not survive a `LIMIT`" — which is
  exactly what `visibleCte`'s `row_number() - 1` computes. Both sides worked out that the renderer
  indexes into the answer, not into the corpus.
- **Regions and neighbourhoods as different verbs.** `viewport` answers rectangles, `find_neighbors`
  answers topology, and a source composes them. `BoundedSource.supports()` already models the
  refusal side of that. No change wanted.

## Four things to change, in order of what they cost us

**1. The result should be columnar.** `ViewportResult` carries `Vec<ViewportVertex>` — six fields
per vertex through serde — and `Vec<ViewportEdge>`. At the 20,000-mark limit that is 20,000 small
structs to build, serialise and take apart again, to end up as three typed arrays. ADR-0001 deleted
`load()` for this exact cost: 455 ms at 200,000 nodes turning rows into arrays, and 148 ms of it in
an id→index map that `row_number()` makes unnecessary. Returning Arrow — which the engine already
speaks underneath — hands the consumer buffers it can upload without touching them. This is not a
concession to one renderer: columnar is what every consumer of an OLAP engine wants, and the
row-oriented shape is the only part of this verb that is hard to defend generically.

**2. `limit` should not default to 500,000.** Measured, the edge layer is already fog at 2,000 nodes
and legibility is gone well before 50,000; the bounded path here caps at 20,000 and the upload cost
tracks it. A default answer of half a million marks is a default past every ceiling that matters —
renderer, legibility and transport. Either no default, or one in the tens of thousands. The caller
knows the size of its canvas and the verb does not.

**3. `ViewportParams` needs the pinned set.** A reader can drag a node; that changes where it is
*drawn* and never where it is *indexed*. Pan away and back and the rectangle cannot find it, because
the index still has it where the compiler put it. `SliceRequest.pinned` exists for this and rides
along in the predicate rather than as a second query, so the numbering still covers everything
returned. Any interactive viewer on precomputed positions has this problem; the verb should carry
the answer rather than leave each host to bolt one on.

**4. The scan is the ceiling, and it is an implementation change rather than a shape one.** The bbox
predicate is O(N) and so is the edge join; the limit bounds the answer, not the work of finding it.
That is why five million pans at 331 ms — three updates a second — while the renderer sits at
thousands of frames. **Bounded rendering, unbounded querying.** Two attempts to fake an index out of
Parquet row-group statistics both made it slower (`BENCHMARKS.md`), so this needs a real one. The
verb's signature already permits any implementation behind it, which is the part that was designed
well: nothing here asks for a new parameter, only for what happens after it.

## What this makes the benchmark

The instrument. `/view/showcases/graph-bench` drives the same two queries the verb does, at sizes up
to five million, and reports first paint, pan, updates per second and the renderer's ceiling
separately. When an index lands on the fossil side, the number that has to move is the pan at five
million, and this page is where it moves.
