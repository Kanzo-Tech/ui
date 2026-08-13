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
one. The Mosaic peers are **optional** — `load()` and `onceQuery()` need them, the rendering hooks
do not, and a host drawing arrays it already has should not pay for a database.

## The two halves

**Data.** `load(coordinator, spec)` reads a node relation and an edge relation into the four typed
arrays the GPU wants, plus the rows and the id→index `Map` everything else needs. `GraphSpec` names
the columns, so the canvas never reads a schema by name and pointing it at another corpus is a
change of argument, not of code.

**Appearance.** `buffers(loaded, look, host)` turns a look and the *live theme* into per-point
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
is why `load()` takes `xField` / `yField`, and why nothing in this package insists on running a
simulation.

The cost we own at that scale is `load()` itself: 455 ms at 200,000 points of main-thread JavaScript
turning Arrow into a `Map`, rows and typed arrays. DuckDB answers the query in ten. That is the next
thing to fix, and it is a worker plus some SQL, not a renderer problem.

## Gotchas the source will not tell you twice

- **`setConfig` resets everything.** cosmos.gl 3.x resets the whole configuration to defaults and
  then applies the argument. Use `setConfigPartial`. This typechecks either way.
- **`getConnectedLinkIndices` is not a neighbourhood.** It returns only links whose *other* endpoint
  is also in the argument — an induced subgraph. Use `neighboursOf(graph, index)`.
- **`requestAnimationFrame` never fires in a hidden tab**, and cosmos.gl drives its simulation from
  rendered frames. A backgrounded graph is stopped, not slow.
