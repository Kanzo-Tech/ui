/**
 * The graph view over an Apache GraphAr graph. `@kanzo-tech/graphar-duckdb` reads and this package
 * draws, and nothing crosses between them but GraphAr's catalog: the host attaches the graph with
 * `attachGraph` on the page's `engine()`, and `GraphRoot` draws the whole of it.
 *
 * Four layers, imports pointing down, each the shape of a named reference — `/docs/design/graph`:
 *
 * - `core/` — the reads, each table read whole into arrays indexed by the global id, and a store in
 *   TanStack Query's observer shape. No React and no cosmos.gl; its statements are built from
 *   mosaic-sql's nodes in `source.ts` and `client.ts`, and none is written in a string.
 * - `render/` — those arrays to cosmos.gl: uploaded once per graph, repainted by kind, rendered once
 *   a frame.
 * - `react/` — the adapter, TanStack Query's core/adapter split: `useGraph`; `useGraphContext`;
 *   `useGraphState`, a selector over the store in the shape of TanStack Store's `useStore`, because
 *   the api is commands and the state moves at frame rate; and `usePick`, a place beside the canvas
 *   picking vertices as a clause of its own.
 * - `parts/` — `GraphRoot`, `GraphRootProvider`, `GraphCanvas`, `GraphLegend`, `GraphCounts`,
 *   `GraphStatus`, `GraphToolbar`, `GraphInspector`, `GraphSearch`: flat parts over the one context,
 *   with `useGraph` and `useGraphContext` Ark's four. They own the vocabulary; the root's callbacks
 *   are the host's policy. The graph's settings are no part of this package: they are
 *   `GRAPH_SECTION`, drawn by `@kanzo-tech/ui`'s `PreferencesSections`, and the root is the section's
 *   owner — it answers the graph's columns and the options' pictures.
 *
 * **Why a package and not `@kanzo-tech/ui`.** The first admission rule is *domain-free — nothing
 * about RDF / SHACL / fossil / graphs / auth*. Graphs are excluded by name, and a sibling package is
 * the only place a required WebGL peer belongs.
 */

export { GraphRoot, GraphRootProvider, type GraphRootProps, type GraphRootProviderProps } from "./parts/graph-root";
export { useGraphContext } from "./react/use-graph-context";
export { useGraph, type GraphApi, type UseGraphProps } from "./react/use-graph";
export { useGraphState } from "./react/use-graph-state";
export { useGraphPrefs } from "./react/use-graph-prefs";
export { usePick, type VertexPick } from "./react/use-pick";

export { GraphCanvas, type GraphCanvasProps, type GraphCanvasTranslations } from "./parts/graph-canvas";
export { GraphLegend, type GraphLegendProps, type GraphLegendTranslations } from "./parts/graph-legend";
export { GraphCounts, type GraphCountsProps, type GraphCountsTranslations } from "./parts/graph-counts";
export { GraphStatus, type GraphStatusProps, type GraphStatusTranslations } from "./parts/graph-status";
export { GraphToolbar, type GraphToolbarProps, type GraphToolbarTranslations } from "./parts/graph-toolbar";
export { GraphInspector, type GraphInspectorProps, type GraphInspectorTranslations } from "./parts/graph-inspector";
export { GraphSearch, type GraphSearchProps, type GraphSearchTranslations } from "./parts/graph-search";

// The picture: form and forces. `lookFrom` and `simFrom` parse what `@kanzo-tech/graph/section`
// declares and a preferences panel writes; where the points come from is what `useGraphPrefs` reads.
export { lookFrom, type Shape } from "./render/graph-looks";
export { simFrom } from "./render/graph-sim";
export type { Channels, Placement } from "./core/channels";

export type {
  GraphCommands,
  LabelLevel,
  Look,
  LookPatch,
  Motion,
  Sim,
  Tool,
  VertexId,
  VertexSelection,
  VertexSelectionSource,
} from "./core/types";
export type { DataStatus, Drawn, GraphState } from "./core/state";
export type { VertexDetail } from "./core/source";
