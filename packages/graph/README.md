# @kanzo-tech/graph

The graph view over a [fossil](https://github.com/Kanzo-Tech/fossil-lang) corpus, drawn with
[cosmos.gl](https://cosmosgl.github.io/graph). fossil is the backend and this package is the view:
the host opens the corpus, and `GraphRoot` draws the whole of it — no SQL is written here.

## Install

```sh
pnpm add @kanzo-tech/graph @cosmos.gl/graph @fossil-lang/corpus @kanzo-tech/mosaic @kanzo-tech/ui lucide-react @uwdata/mosaic-core @uwdata/mosaic-sql
```

Every peer is required. `@fossil-lang/corpus` reads the corpus, `@kanzo-tech/mosaic` is the page's one
DuckDB-WASM engine and its crossfilter, cosmos.gl draws, and the parts are built from
`@kanzo-tech/ui` and its icons.

## The one path

```tsx
import { open } from "@fossil-lang/corpus";
import { engine } from "@kanzo-tech/mosaic";
import { GraphCanvas, GraphCounts, GraphInspector, GraphLegend, GraphRoot, GraphStatus, GraphToolbar } from "@kanzo-tech/graph";

const corpus = engine().then((e) => open(url, { engine: e }));

<GraphRoot corpus={corpus} r="degree" filterBy={crossfilter} onFailure={setFailure}>
  <GraphCanvas>
    <GraphToolbar />
    <GraphLegend />
  </GraphCanvas>
  <GraphStatus />
  <GraphCounts />
  <GraphInspector />
</GraphRoot>;
```

**Opening is the host's.** Where the corpus is and what signs it are the host's to say — a private
corpus opens as `` open(`jobs/${id}`, { engine, host }) `` — and `GraphRoot` takes what came back,
or the promise of it, which is what lets it say it is opening. Closing it is the host's too.

**The whole corpus is drawn**: every vertex table with a position — fossil's layout or the
program's own columns — and every relation whose two ends are drawn, read once, one scan per table,
and uploaded once. A vertex's `dense_id` is its index in the buffers. The camera reads nothing.

**The channels are Plot's**: `fill`, `symbol`, `r`, `stroke` and `title`, where a CSS colour is a
constant and anything else is a column. Unbound, colour is the vertex type and a label is the table's
`identity`. Changing a column binding re-reads that column and nothing else.

**`filterBy` is the page's crossfilter.** Its clauses are translated into scan's filter, and what
does not survive is hidden; a clause that cannot be translated reaches `onFailure` rather than being
dropped. A lasso or a click publishes the reader's pick back into it, exempting the graph itself.

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
- `GraphSearch` — every drawn vertex's text, read once and filtered in the browser; picking reveals.
- `GraphInspector` — the focused vertex's row, with a render prop for a product's own fields.
- `GraphLooks` — Nebula, Atlas and Ink as presets over `GRAPH_SECTION`'s axes, with the axes —
  marks, edges, labels, the backdrop — always in view under them. Needs `GRAPH_SECTION` on the theme
  provider, and no root.
- `GraphPlacement` — Force, Map or Clustered as cards, with the corpus's own columns to bind under
  the checked one, beside the card and never inside it. Controlled: `value`/`onChange` of the root's `x`, `y` and `cluster`.
- `ShapeGlyph` — the glyph the canvas draws for a category, in the DOM.

No part takes a callback of its own: what a click means is `onSelect`, `onFocus` and `onFailure` on
the root, and `GraphPlacement`'s `onChange` only hands back the root's own bindings.
`onFailure` is required and receives every failure as thrown — fossil's coded errors, and the graph's
own `GraphError` (`graph/no-webgl`, `graph/context-lost`, `graph/no-positions`,
`graph/nothing-to-draw`, `graph/unfilterable`).

- `lookFrom`, `simFrom`, `useGraphPrefs` — the form and the forces from a preferences panel's
  answers, and the look `preset` they are; `scaleOf` — what colour and shape a category wears.
- `VertexId` — a vertex is its `dense_id`, a `number`.

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
