/**
 * The graph view over a fossil corpus. fossil reads and this package draws, and nothing crosses
 * between them but the corpus contract: the host opens the corpus with fossil's `open` on the page's
 * `engine()`, and `GraphRoot` draws the whole of it.
 *
 * Four layers, each the shape of a named reference — `/docs/design/graph`:
 *
 * - `core/` — the loader, one `scan` per table read whole into arrays indexed by the corpus's key, and a
 *   store in TanStack Query's observer shape. No React, no cosmos.gl, no SQL.
 * - `render/` — those arrays to cosmos.gl: uploaded once per corpus, repainted by kind, rendered once
 *   a frame.
 * - `react/` — `useGraph`, `GraphRoot`, `GraphRootProvider`, `useGraphContext`: Ark's four;
 *   `useGraphState`, TanStack Store's selector, because the api is commands and the state moves at
 *   frame rate; and `usePick`, a place beside the canvas picking vertices as a clause of its own.
 * - `parts/` — `GraphCanvas`, `GraphLegend`, `GraphCounts`, `GraphStatus`, `GraphToolbar`,
 *   `GraphInspector`, `GraphSearch`, `GraphTimeline`: flat parts over the one context. They own the
 *   vocabulary; the root's callbacks are the host's policy. The graph's settings are no part of
 *   this package: they are `GRAPH_SECTION`, drawn by `@kanzo-tech/ui`'s `PreferencesSections`, and
 *   the root is the section's owner — it answers the corpus's columns and the options' pictures.
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
export { usePick, type Pick } from "./react/use-pick";

export { GraphCanvas, type GraphCanvasProps } from "./parts/graph-canvas";
export { GraphLegend, type GraphLegendProps } from "./parts/graph-legend";
export { GraphCounts, type GraphCountsProps } from "./parts/graph-counts";
export { GraphStatus, type GraphStatusProps } from "./parts/graph-status";
export { GraphToolbar, type GraphToolbarProps } from "./parts/graph-toolbar";
export { GraphInspector, type GraphInspectorProps } from "./parts/graph-inspector";
export { GraphSearch, type GraphSearchProps } from "./parts/graph-search";
export { GraphTimeline, type GraphTimelineProps } from "./parts/graph-timeline";
export { ShapeGlyph, type ShapeGlyphProps } from "./parts/shape-glyph";

// The picture: form, forces, where the points come from, and the scale a legend asks what a
// category wears. `lookFrom`, `simFrom` and `placementFrom` parse what `@kanzo-tech/graph/section`
// declares and a preferences panel writes.
export { lookFrom, type LabelLevel, type Look, type LookPatch, type Shape } from "./render/graph-looks";
export { simFrom, type Sim } from "./render/graph-sim";
export { scaleOf } from "./render/graph-model";
export { placementFrom, type Channels, type Placement } from "./core/channels";

export type { GraphCommands, Motion, Selection, SelectionSource, Tool, VertexId } from "./core/types";
export type { DataStatus, Drawn, GraphState } from "./core/state";
export type { VertexDetail } from "./core/source";
// The corpus as the join graph `@kanzo-tech/mosaic`'s relations are built over.
export { readJoinGraph } from "./core/join-graph";
export { GraphError } from "./core/error";
