# @kanzo-tech/graph

The graph view over an [Apache GraphAr](https://graphar.apache.org/) graph — what
[fossil](https://github.com/Kanzo-Tech/fossil-lang) compiles a program to — drawn with
[cosmos.gl](https://cosmosgl.github.io/graph). The host attaches the graph with
[`@kanzo-tech/graphar-duckdb`](https://github.com/Kanzo-Tech/graphar)'s `attachGraph`, and
`GraphRoot` draws the whole of it from the `Graph` that answers: its vertex and edge types, each
type's relation and index, and its reads of a vertex, the links and a search. Nothing of GraphAr's
format is written here — no column, no file, no catalog table — and nothing of graphar's is imported
but its types.

## Install

```sh
pnpm add @kanzo-tech/graph @cosmos.gl/graph @kanzo-tech/graphar-duckdb @kanzo-tech/mosaic @kanzo-tech/ui lucide-react @uwdata/mosaic-core @uwdata/mosaic-sql
```

Every peer is required. `@kanzo-tech/mosaic` is the page's one DuckDB-WASM engine and its
crossfilter, cosmos.gl draws, and the parts are built from `@kanzo-tech/ui` and its icons.
`@kanzo-tech/graphar-duckdb` is the host's, to attach the graph with; the graph takes its types and
nothing else from it.

## The one path

```tsx
import { attachGraph } from "@kanzo-tech/graphar-duckdb";
import { engine } from "@kanzo-tech/mosaic/engine";
import { GraphCanvas, GraphCounts, GraphInspector, GraphLegend, GraphRoot, GraphStatus, GraphToolbar } from "@kanzo-tech/graph";

const e = await engine();
const graph = await attachGraph(e, "archive", (paths) => paths.map((p) => `${url}/${p}`), { entry: "fossil.graph.yml" });

// Under `<MosaicProvider engine={e} graph={graph}>`:
const { selection } = useMosaic();

<GraphRoot graph={graph} engine={e} r="degree" filterBy={selection} onFailure={setFailure}>
  <GraphCanvas>
    <GraphToolbar />
    <GraphLegend />
  </GraphCanvas>
  <GraphStatus />
  <GraphCounts />
  <GraphInspector />
</GraphRoot>;
```

**Attaching is the host's**, and so is detaching: `attachGraph` answers the `Graph`, whose `detach()`
gives the catalog back, and `GraphRoot` takes it as `graph`. `graph={null}` is no graph yet; the
canvas is mounted either way and waits over an empty surface.

**The whole graph is drawn**: every vertex type and every edge type between two of them, read once, one statement per type, and uploaded once. A
vertex's `dense_id` is its index in the buffers: its index within its type, as the `Graph` names it,
plus the counts of the vertex types before it, in the graph's order. The camera reads nothing.

**The channels are Plot's**: `fill`, `symbol`, `r`, `stroke` and `title`, where a CSS colour is a
constant and anything else is a column. Unbound, colour is the vertex type and a label is the type's
primary key, or its id where it has none. Changing a column binding re-reads that column and nothing else.
A multi-valued property is a `list` property of its type: the inspector shows its values and a search
finds them, but it is never offered as an axis, a group or a field.

**`filterBy` is the page's selection** — `useMosaic().selection` under a `MosaicProvider` given the
graph. The graph is one more client of it, reading `verticesOf(graph)`: every vertex as one relation,
`NULL` where a type has no such property. A clause on a pattern reaches it on the vertices the
pattern's rows stand for, and a column clause keeps none of a type without the column; what it drops is greyed out on the canvas,
never hidden. A lasso or a click publishes the reader's pick back into it as a semi-join on the vertex
key, on every vertex, exempting the graph itself; `usePick` does the same for a place beside the canvas.
The graph's first load waits for every chart on its page that has not drawn yet, so a timeline under
it — `<ChartTimeline relation={verticesOf(graph)} field={useGraphPrefs().timeline} />` — comes up with it.

**The layout is off at load.** The graph's positions are drawn as they are; `GraphToolbar` runs and
stops a force layout from where the points are. Dragging a node pins it only while a layout runs,
and releasing the pins reheats it. While a layout runs the camera follows the points until the reader
zooms or pans. `status` is the data's life and `motion` the layout's — two axes, because each moves
without the other. At 200,000 vertices the viewer's p95 frame interval is 9.0 ms against 9.3 ms for
cosmos.gl alone.

The reference composition is the docs' workspace showcase: one `GraphRoot` around a shell with the
graph, a second main view and a dock of panels.

## The pieces

- `GraphRoot` — `useGraph` plus the context. `GraphRootProvider` takes an api a host built with
  `useGraph`; `useGraphContext` reads it — Ark's four, one for one. The api is the commands and
  never changes; `useGraphState(selector)` reads a slice of the state.
- `GraphCanvas` — the element, the grid, the vignette, the labels, the hover card and the marquee
  and lasso gesture. Children are chrome positioned over it.
- `GraphToolbar` — the selection tools, the selection, zoom and fit, and the layout's transport.
- `GraphLegend` — one row per category: glyph, name and how many are drawn.
- `GraphStatus` — where the graph is, in one word: Loading, Laying out 42%, Ready or Failed.
- `GraphCounts` — the graph and what the filter keeps of it: "5K nodes · 8K edges", or
  "1.2K of 5K nodes match · 3K edges".
- `GraphSearch` — a ⌘K palette that asks the graph, on the engine, once per pause in
  typing (150 ms): the first `limit` matches and how many there are of each type, under every other
  clause on the crossfilter (`usePick("search").predicate()`), with how many more lie outside it.
  Nothing is read before the reader types and no text is held in the page. `type:Person` and
  `<column>:<value>` narrow it; Enter reveals a match, ⌘Enter adds every match to the subset.
- `GraphInspector` — the focused vertex's row, with a render prop for a product's own fields.
- `ShapeGlyph` — the glyph the canvas draws for a category, in the DOM.

No part takes a callback of its own: what a click means is `onSelect`, `onFocus` and `onFailure` on
the root. The graph's settings are no part: they are `GRAPH_SECTION` on `@kanzo-tech/graph/section`,
drawn by `@kanzo-tech/ui`'s `PreferencesSections`.
`onFailure` is required and receives every failure as thrown — the engine's and the host's coded errors, and the graph's
own `Problem`s (`graph/no-webgl`, `graph/context-lost`, `graph/no-positions`,
`graph/nothing-to-draw`, `graph/too-large`).

- `usePick(id)` — a place beside the canvas picking vertices as a clause of its own:
  `pick(ids | null, label)`, `picked`, and `predicate()`, the subset as that place sees it.
- `lookFrom`, `simFrom`, `placementFrom`, `useGraphPrefs` — the form, the forces and where the
  points come from, read from `GRAPH_SECTION`'s answers; `scaleOf` — what colour and shape a
  category wears.
- `VertexId` — a vertex is its global `dense_id`, a `number`.
- `verticesOf(graph)` — every vertex as one relation of the page, for a chart beside the canvas.

The full guide — the parts, layout and camera, and the workspace recipe — is at
[kanzo-tech.github.io/ui/docs/graph](https://kanzo-tech.github.io/ui/docs/graph).

## Why a package, and not part of `@kanzo-tech/ui`

The [first admission rule](https://kanzo-tech.github.io/ui/docs/philosophy#admission) is
*domain-free — nothing about RDF / SHACL / fossil / **graphs** / auth*. Graphs are excluded by name,
and a sibling package is the only honest home for a required WebGL peer.

## Gotchas the source will not tell you twice

- **`setConfig` resets everything.** cosmos.gl 3.x resets the whole configuration to defaults and
  then applies the argument. Use `setConfigPartial`. This typechecks either way.
- **`getConnectedLinkIndices` is not a neighbourhood.** It returns only links whose *other* endpoint
  is also in the argument. `getNeighboringPointIndices` is the neighbourhood.
- **`requestAnimationFrame` never fires in a hidden tab**, and the renderer draws on animation
  frames. A backgrounded graph is stopped, not slow.
