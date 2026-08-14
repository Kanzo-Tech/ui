# @kanzo-tech/graph

A GPU graph view over [cosmos.gl](https://cosmosgl.github.io/graph): the DuckDB relation that feeds
it, the buffers that colour it from the page's own theme, and the hooks that own the renderer's
lifetime.

## What it is not

**There is no `<GraphCanvas>`.** That is the shape of the package rather than a gap in it. A graph
canvas is a toolbar, a legend, an inspector, a hover card and a search box wired to one renderer,
and every one of those answers differently per product. What is genuinely shared sits underneath —
reading a relation into typed arrays, turning a look and the live theme into GPU buffers, owning the
renderer across React's lifecycle, and keeping a lasso inside a Mosaic crossfilter. Those are here.
The arrangement belongs at the call site; `docs/showcases/workspace/graph-canvas.tsx` is one, and it
is not the only possible one.

## Why a package, and not part of `@kanzo-tech/ui`

`DESIGN.md`'s first admission rule is *domain-free — nothing about RDF / SHACL / fossil / **graphs**
/ auth*. Graphs are excluded by name, deliberately: `ui` is the generic vocabulary every product
shares. A sibling package is also the only honest home for a **required** WebGL peer — as an
optional peer of `ui` it would have been a lie about what the package is.

## Install

```sh
pnpm add @kanzo-tech/graph @cosmos.gl/graph
```

`@cosmos.gl/graph` is a required peer: this is a renderer, and there is nothing left of it without
one. The Mosaic peers are **optional** — `duckBoundedSource()` and `onceQuery()` need them, the
rendering hooks do not, and a host drawing arrays it already has should not pay for a database.

## The two halves

**Data.** A **source** answers one question — *what should I draw* — and `useBoundedGraph` asks it.
The answer is a `Slice`: at most `limit` points as parallel typed arrays, whose size follows the
question rather than the corpus. Moving the camera re-asks; zooming out past `lodThreshold` gets
super-nodes instead of nodes, so a view of everything is still a few thousand marks.

`duckBoundedSource` — on `@kanzo-tech/graph/duckdb`, because that is the half that needs Mosaic —
answers over two DuckDB relations and takes the column names as options, so pointing it at another
corpus is a change of argument, not of code. A host that already holds its arrays takes
`memorySource` and pays for no database; under `limit` either one is asked once and never again, so
a graph that fits pays for nothing.

**A point is addressed by index and identified by pair.** cosmos.gl numbers points by their position
in the arrays it was last handed, so index 7 is whatever the current answer put seventh. A vertex is
therefore `vertexId(type, dense)` — a `bigint`, and `Slice.vertices` a `BigUint64Array`, because the
pair is 64 bits and a `number` holds 53. Anything that outlives one answer is held as a `VertexId`
and resolved through the `Resident` that `useBoundedGraph` rebuilds per answer. Do not build a second
map: a copy assembled beside it is the same value one render later, with no way to notice it has
fallen behind the buffers on screen.

**Appearance.** `buffers(slice, look, host)` turns a look and the *live theme* into per-point
colours, sizes and shapes. A `Look` carries **geometry only** — colour comes from the page's
categorical scale (`categoricalColor`, on the **root** barrel of `@kanzo-tech/ui` — not
`/analytics`, so reaching it costs nobody the DuckDB peer set), because a scale a graph invents is a
scale that disagrees with the legend explaining it.

`appearance()` is the other side of that line and it matters for performance: everything that is
*one number for the whole canvas* is a cosmos.gl **uniform**, read fresh on every draw. Multiply a
slider into 500,000 sizes and every tick re-uploads the array; put it in a uniform and it costs
nothing.

## Scale

Measured, not asserted — see `BENCHMARKS.md` at the repository root, and
`/view/showcases/graph-bench` to re-run it.

A live simulation is comfortable to about **50,000** points and finished by **200,000** (a step
costs 62 ms there). A million points render, upload and simulate without failing, but at 440 ms a
step. **Past 200,000 the honest design is positions computed once and stored as a column** — which
is why a source names `xField` / `yField`, and why a simulation is off by default: the coordinates a
source hands back are the index the next spatial question is asked against, and a force that moves
them moves the picture out from under its own index.

Bounded, over a corpus compiled once, first paint is **253 ms at a million** against the 1,225 ms it
used to cost to hold two hundred thousand. What is drawn and transferred follows the window — the
upload is flat at 23–30 ms and the redraw ceiling stays in the thousands of frames per second. What
is *scanned* does not: the pan grows from 77 ms at a million to 256 ms at five, and the term that
grows is the edge join, over one file on a DuckDB-WASM that gets a single thread. That is the next
thing to fix, and it is the corpus layout, not the renderer.

## Gotchas the source will not tell you twice

- **`setConfig` resets everything.** cosmos.gl 3.x resets the whole configuration to defaults and
  then applies the argument. Use `setConfigPartial`. This typechecks either way.
- **`getConnectedLinkIndices` is not a neighbourhood.** It returns only links whose *other* endpoint
  is also in the argument — an induced subgraph. Use `neighboursOf(graph, index)`.
- **`requestAnimationFrame` never fires in a hidden tab**, and cosmos.gl drives its simulation from
  rendered frames. A backgrounded graph is stopped, not slow.
