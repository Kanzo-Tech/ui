/**
 * The graph view over a fossil corpus. fossil reads and this package draws, and nothing crosses
 * between them but the corpus contract: the host opens the corpus with fossil's `open` on the page's
 * `engine()`, and `GraphRoot` draws it.
 *
 * Four layers, each the shape of a named reference — `/docs/design/graph`:
 *
 * - `core/` — a headless tileset in deck.gl's `Tileset2D` shape over `tileMatrix` and `scan`, and a
 *   store in TanStack Query's observer shape. No React, no cosmos.gl, no SQL.
 * - `render/` — tiles to cosmos.gl buffers: encoded once per tile, uploaded by kind, rendered once a
 *   frame.
 * - `react/` — `useGraph`, `GraphRoot`, `GraphRootProvider`, `useGraphContext`: Ark's four; and
 *   `useGraphState`, TanStack Store's selector, because the api is commands and the state moves at
 *   frame rate.
 * - `parts/` — `GraphCanvas`, `GraphLegend`, `GraphToolbar`, `GraphInspector`: flat parts over the
 *   one context. They own the vocabulary; the root's callbacks are the host's policy.
 *
 * **Why a package and not `@kanzo-tech/ui`.** The first admission rule is *domain-free — nothing
 * about RDF / SHACL / fossil / graphs / auth*. Graphs are excluded by name, and a sibling package is
 * the only place a required WebGL peer belongs.
 */

export {
  GraphRoot,
  GraphRootProvider,
  useGraphContext,
  type GraphRootProps,
  type GraphRootProviderProps,
} from "./react/graph-root";
export { useGraph, type GraphApi, type UseGraphProps } from "./react/use-graph";
export { useGraphState } from "./react/use-graph-state";
export { useGraphPrefs } from "./react/use-graph-prefs";

export { GraphCanvas, type GraphCanvasProps } from "./parts/graph-canvas";
export { GraphLegend, type GraphLegendProps } from "./parts/graph-legend";
export { GraphToolbar, type GraphToolbarProps } from "./parts/graph-toolbar";
export { GraphInspector, type GraphInspectorProps } from "./parts/graph-inspector";
export { ShapeGlyph, type ShapeGlyphProps } from "./parts/shape-glyph";

// The picture: form, forces and the scale a legend asks what a category wears. `lookFrom` and
// `simFrom` parse what `@kanzo-tech/graph/section` declares and a preferences panel writes.
export { lookFrom, type Look, type LookPatch, type Shape } from "./render/graph-looks";
export { simFrom, type Sim } from "./render/graph-sim";
export { adaptive } from "./render/adaptive";
export { scaleOf } from "./render/graph-model";
export type { Channels } from "./core/channels";

// Identity: a vertex is `(type_idx, dense_id)`, and everything that outlives one composition is held
// as one and re-resolved through the api's `Resident`. A host never builds its own map.
export { vertexId, typeOf, denseOf, type Resident, type VertexId } from "./core/resident";

export type { GraphCommands, Motion, Selection, SelectionSource, Tool } from "./core/types";
export type { Drawn, GraphState, GraphStatus } from "./core/state";
export type { VertexDetail } from "./core/detail";
