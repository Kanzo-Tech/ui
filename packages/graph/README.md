# @kanzo-tech/graph

The graph view over a [fossil](https://github.com/kanzo-tech/fossil) corpus, drawn with
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
import { GraphCanvas, GraphInspector, GraphLegend, GraphRoot, GraphToolbar } from "@kanzo-tech/graph";

const corpus = engine().then((e) => open(url, { engine: e }));

<GraphRoot corpus={corpus} r="degree" filterBy={crossfilter} onFailure={setFailure}>
  <GraphCanvas>
    <GraphToolbar />
    <GraphLegend />
  </GraphCanvas>
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

## The pieces

- `GraphRoot` — `useGraph` plus the context. `GraphRootProvider` takes an api a host built with
  `useGraph`; `useGraphContext` reads it — Ark's four, one for one. The api is the commands and
  never changes; `useGraphState(selector)` reads a slice of the state.
- `GraphCanvas` — the element, the grid, the vignette, the labels, the hover card and the marquee
  and lasso gesture. Children are chrome positioned over it.
- `GraphLegend`, `GraphToolbar`, `GraphInspector` — the categorical scale with its tally, the
  commands drawn, and the focused vertex's row with a render prop for a product's own fields. No
  part takes a callback: what a click means is `onSelect`, `onFocus` and `onFailure` on the root.
- `lookFrom`, `simFrom`, `useGraphPrefs` — the form and the forces from a preferences panel's
  answers; `scaleOf` — what colour and shape a category wears.
- `VertexId` — a vertex is its `dense_id`, a `number`.

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
