# @kanzo-tech/graph

The graph view over a [fossil](https://github.com/Kanzo-Tech/fossil-lang) corpus, drawn with
[cosmos.gl](https://cosmosgl.github.io/graph). fossil is the backend and this package is the view:
the host attaches the corpus, and `GraphRoot` draws the whole of it, reading it with SQL through the
page's coordinator. Nothing of fossil's is imported: the contract is the catalog, `fossil_tables` and
`fossil_columns`.

## Install

```sh
pnpm add @kanzo-tech/graph @cosmos.gl/graph @fossil-lang/corpus @kanzo-tech/mosaic @kanzo-tech/ui lucide-react @uwdata/mosaic-core @uwdata/mosaic-sql
```

Every peer is required. `@kanzo-tech/mosaic` is the page's one DuckDB-WASM engine and its
crossfilter, cosmos.gl draws, and the parts are built from `@kanzo-tech/ui` and its icons.
`@fossil-lang/corpus` is the host's, to attach the corpus with; the graph never imports it.

## The one path

```tsx
import { attach } from "@fossil-lang/corpus";
import { engine } from "@kanzo-tech/mosaic";
import { GraphCanvas, GraphCounts, GraphInspector, GraphLegend, GraphRoot, GraphStatus, GraphToolbar } from "@kanzo-tech/graph";

const e = await engine();
await attach("archive", { engine: e, url }); // views "archive"."<Table>", fossil_tables, fossil_columns

<GraphRoot from="archive" coordinator={e.coordinator} r="degree" filterBy={crossfilter} onFailure={setFailure}>
  <GraphCanvas>
    <GraphToolbar />
    <GraphLegend />
  </GraphCanvas>
  <GraphStatus />
  <GraphCounts />
  <GraphInspector />
</GraphRoot>;
```

**Attaching is the host's**, and so is detaching: `attach` answers the attachment whose `detach()`
gives the catalog back, and `GraphRoot` takes the name it was attached under as `from`.
`from={null}` is no corpus yet; the canvas is mounted either way and waits over an empty surface.

**The whole corpus is drawn**: every vertex table with a position — fossil's layout or the
program's own columns — and every relation whose two ends are drawn, read once, one scan per table,
and uploaded once. A vertex's `dense_id` is its index in the buffers. The camera reads nothing.

**The channels are Plot's**: `fill`, `symbol`, `r`, `stroke` and `title`, where a CSS colour is a
constant and anything else is a column. Unbound, colour is the vertex type and a label is the table's
`identity`. Changing a column binding re-reads that column and nothing else.

**`filterBy` is the page's crossfilter.** A clause is column predicates or a semi-join on identity,
`dense_id IN (…)`; what it drops is greyed out on the canvas, never hidden, and a clause no vertex
table can answer reaches `onFailure` as `graph/unfilterable` rather than being dropped. A lasso or a
click publishes the reader's pick back into it as a semi-join on the vertex key, exempting the graph
itself; `usePick` does the same for a place beside the canvas.

**The layout is off at load.** The corpus's positions are drawn as they are; `GraphToolbar` runs and
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
- `GraphCounts` — the corpus and what the filter keeps of it: "5K nodes · 8K edges", or
  "1.2K of 5K nodes match · 3K edges".
- `GraphSearch` — a ⌘K palette that asks the corpus, through the coordinator, once per pause in
  typing (150 ms): the first `limit` matches and how many there are of each type, under every other
  clause on the crossfilter (`usePick("search").predicate()`), with how many more lie outside it.
  Nothing is read before the reader types and no text is held in the page. `type:Person` and
  `<column>:<value>` narrow it; Enter reveals a match, ⌘Enter adds every match to the subset.
- `GraphInspector` — the focused vertex's row, with a render prop for a product's own fields.
- `GraphTimeline` — one temporal column brushed and played under the canvas, the column being the
  `time-by` setting; its window reaches the page as identity.
- `ShapeGlyph` — the glyph the canvas draws for a category, in the DOM.

No part takes a callback of its own: what a click means is `onSelect`, `onFocus` and `onFailure` on
the root. The graph's settings are no part: they are `GRAPH_SECTION` on `@kanzo-tech/graph/section`,
drawn by `@kanzo-tech/ui`'s `PreferencesSections`.
`onFailure` is required and receives every failure as thrown — fossil's coded errors, and the graph's
own `GraphError` (`graph/no-webgl`, `graph/context-lost`, `graph/no-positions`,
`graph/nothing-to-draw`, `graph/unfilterable`).

- `usePick(id)` — a place beside the canvas picking vertices as a clause of its own:
  `pick(ids | null, label)`, `picked`, and `predicate()`, the subset as that place sees it.
- `lookFrom`, `simFrom`, `placementFrom`, `useGraphPrefs` — the form, the forces and where the
  points come from, read from `GRAPH_SECTION`'s answers; `scaleOf` — what colour and shape a
  category wears.
- `VertexId` — a vertex is its `dense_id`, a `number`.

### The readers

- `readJoinGraph(coordinator, from)` — the corpus attached as `from` as a `JoinGraph`, read from
  `fossil_tables` and `fossil_columns`: each vertex table a type keyed by `dense_id` that projects
  the columns the writer gave no role, each edge table joined through `src` and `dst`. It is what
  `@kanzo-tech/mosaic`'s relations — and `@kanzo-tech/ui/analytics`' relation dashboards — are built
  over; `relationRootKey` names the key a relation publishes to the page through.

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
