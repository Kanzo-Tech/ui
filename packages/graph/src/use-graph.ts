"use client";

import type { Graph } from "@cosmos.gl/graph";
import { useCallback, useMemo, useRef, type RefObject } from "react";
import type { BoundedSource, Slice } from "./bounded";
import { LOOKS, type Look } from "./graph-looks";
import { isColour, type Channels } from "./graph-model";
import { residentOf, type Resident, type VertexId } from "./resident";
import type { Display, Motion, Sim } from "./types";
import { useBoundedGraph } from "./use-bounded-graph";
import { useCosmosGraph, type CosmosGraphOptions } from "./use-cosmos-graph";
import { useGraphLook } from "./use-graph-look";

/**
 * Everything a graph is, above the element that draws it.
 *
 * **This is Ark's `useX(props) → api`, and the reason it exists is a host that could not adopt
 * `GraphCanvas`.** The component owned the renderer, the query loop and the look, and published them
 * through a context — which a legend or an inspector can read, because those are `children`. What
 * cannot read a context is anything that sits *above* the element: `useGraphOverlays` wants
 * `getGraph` and `getResident`, the `events` block wants the same accessors, and both are arguments
 * to a hook called in the component that renders the canvas rather than inside it. The workspace
 * needed them in thirty places and so kept its own copy of all three.
 *
 * The general answer to that circularity is Ark's, and it is a shape rather than a feature: the
 * factory builds the api where the host can hold it, the provider takes it and renders. What the
 * component version tried instead — `graphRef` and `residentRef` as props, given rather than
 * returned — solved one host's version of it and is deleted by this file.
 *
 * **The structure is copied and the substance is not.** An Ark api's value is its prop getters,
 * which distribute props across many parts. Here there are no parts: a canvas is one element. So
 * there is no `getRootProps()` — `hostRef` is what the provider needs and all it needs — and
 * inventing one for the resemblance would be cargo cult. `CONVENTIONS.md` is where that line is
 * drawn, not here.
 */

/**
 * The gestures, in the terms the rest of this package speaks.
 *
 * cosmos.gl reports a **buffer index**, which names a slot in the answer currently uploaded. Every
 * host then wrote the same three lines — resolve the index through the resident map, return early if
 * it resolves to nothing, carry on with the identity — because an index is not something you can
 * keep. The factory already holds that map, so it does the resolving and a callback that would have
 * been handed a stale slot is simply not called.
 *
 * `onZoom` is the one with a duty attached: the camera moving is how a bounded graph is re-asked,
 * and the loop issues that `refresh` itself. What arrives here is the notification, for a host that
 * has overlays to reposition.
 */
export interface GraphEvents {
  onBackgroundClick?: () => void;
  onPointClick?: (vertex: VertexId, graph: Graph, index: number) => void;
  onPointerOver?: (vertex: VertexId, index: number) => void;
  onPointerOut?: () => void;
  onDragEnd?: (vertex: VertexId) => void;
  onTick?: () => void;
  onZoom?: () => void;
}

export interface UseGraphProps {
  /** What to draw. `null` renders the frame and asks nothing — a host still resolving its data. */
  source: BoundedSource | null;
  /** Geometry only. Colour comes from the page's categorical scale, never from here. */
  look?: Look;
  display?: Display;
  sim?: Sim;
  /**
   * Off by default, and that is the correct default rather than a cautious one: a bounded source
   * hands back the coordinates its next spatial query is expressed in, so a force moves the picture
   * out from under its own index.
   */
  simulate?: boolean;
  clusters?: (number | undefined)[];
  /**
   * Which column colours a point, **or a CSS colour every point wears** — Plot's channel name,
   * Plot's meaning, and Plot's rule that a colour is a constant and anything else is a column.
   *
   * **A channel is what you want drawn, so it rides the question and not the source.** Baked into a
   * source at construction — which is where this used to live — changing what a graph is coloured by
   * meant building a second source, and *where the bytes are* and *what I want drawn* are not the
   * same question. Changing it here re-asks over the same bytes, which is all it should ever have
   * cost.
   *
   * As a *constant* it costs no query at all: `fill="var(--foreground)"` is the monochrome picture,
   * and it is a binding rather than a look, because a look may not rebind an encoding.
   *
   * Omitted, the source decides which column: it is the only thing that knows what its corpus
   * carries.
   */
  fill?: string;
  /**
   * Which column a point's **shape** carries — Plot's `symbol`, and a peer of colour.
   *
   * Bound to the same column as `fill` this is redundant encoding, which is the point on a colourful
   * document and the only encoding left on a monochrome one. It reads the categorical column the
   * slice already carries, so it costs no query; a *different* column would need a second categorical
   * array in the slice and in every source, and is not paid for.
   *
   * Binding it takes on an obligation — see `gradeComposition`: shape and size spent at once need a
   * radius floor, which is a property of what you composed rather than of the form you picked.
   */
  symbol?: string;
  /**
   * Which column the size ramp is spent on — Plot's `r`.
   *
   * Omitted, every point is drawn at one radius, which is a legitimate picture: without a ramp a
   * look's `form.size` range has only one end.
   */
  r?: string;
  /**
   * What tints a link. **Absent, each link takes the colour of the vertex it leaves**; a constant
   * like `var(--muted-foreground)` makes links plain structure.
   */
  stroke?: string;
  /** Vertices that stay drawn whatever the camera is over. */
  pinned?: VertexId[];
  limit?: number;
  debounce?: number;
  /**
   * Required, and the only one.
   *
   * Its silence is a defect rather than a choice: unhandled, a browser with no WebGL context shows
   * an empty box and says nothing, and what stands in its place is the host's decision.
   */
  onFailure: (message: string) => void;
  events?: GraphEvents;
  report?: (motion: Motion) => void;
  reportProgress?: (value: number) => void;
  /**
   * Ask the overlays to reposition after a look has been uploaded.
   *
   * Optional, and only owed to `useGraphOverlays`: point sizes changed, so labels sit differently,
   * and a look change does not tick — with a simulation off there is nothing to schedule a repaint
   * off. A host drawing no labels passes nothing.
   *
   * It goes through the props rather than being read off the api because `useGraphOverlays` is
   * declared *after* this hook — it needs `getGraph` and `getResident` from it. A host bridges the
   * two with one ref, which is the smallest honest answer to a cycle that is genuinely mutual:
   * overlays need the graph, and the graph's repaint owes the overlays a nudge.
   */
  schedule?: () => void;
}

/**
 * What a graph publishes — to its own chrome through the provider, and to its host directly.
 *
 * Getters rather than values for the two that change every answer: a legend, an inspector and a
 * hover card all read the graph and the resident map from inside callbacks, and publishing them as
 * values would re-render every consumer on every camera move to hand back a reference they only
 * dereference when something is clicked. `slice` and `resident` ARE values, because a legend counts
 * what is drawn and has to re-render when that changes.
 *
 * **There is no `graphRef` here, and that is deliberate.** `getGraph()` answers every read of it,
 * and a ref object as well would be two ways to express one thing — with the second one writable,
 * which nothing outside `useCosmosGraph` may be.
 */
export interface GraphApi {
  /**
   * Where the canvas is drawn. `GraphRootProvider` attaches it; a host that renders its own surface
   * attaches it itself, and nothing works until something does.
   */
  hostRef: RefObject<HTMLDivElement | null>;
  getGraph: () => Graph | null;
  getResident: () => Resident;
  /** The answer currently drawn, or `null` before the first one. */
  slice: Slice | null;
  /** Who is drawn and where, rebuilt with every answer — never build a second one. */
  resident: Resident;
  /** How many vertices there are, when the source knows. */
  total: number | undefined;
  /** Whether a question is outstanding. */
  pending: boolean;
  /** Whether this graph is asked in pieces at all, or fitted under the limit and taken whole. */
  sliced: boolean;
  /** Ask again about wherever the camera is now. Wired to the camera already. */
  refresh: () => void;
  /** Ask a topological question instead of a spatial one, when the source supports one. */
  explore: (seeds: VertexId[], depth: number) => void;
}

/** The empty answer, built once — a ref has to hold something before the first slice arrives. */
const NOBODY = residentOf(null);

export function useGraph(props: UseGraphProps): GraphApi {
  const {
    clusters,
    debounce,
    display,
    events,
    fill,
    limit,
    look = LOOKS.atlas,
    onFailure,
    pinned,
    r,
    report,
    reportProgress,
    schedule,
    sim,
    simulate = false,
    source,
    stroke,
    symbol,
  } = props;

  /**
   * The two destinations one vocabulary splits into — and the one column they share.
   *
   * A slice carries **one** categorical array, so the query has one column to fetch and the question
   * is which binding names it: `fill` when it is a column, and `symbol` when `fill` is a constant.
   * That is not a fallback, it is the monochrome picture stated exactly — identity has moved to
   * shape, so the column identity lives in is the one `symbol` names.
   *
   * Getting this wrong is not a silent failure, which is the one good thing about it: with `fill` a
   * constant and nothing put in its place, the source fell back to its own default column and DuckDB
   * answered `Referenced column "community" not found`. The browser said so on the first Ink render.
   *
   * `stroke` never reaches a query at all — a link's tint is a decision about drawing.
   */
  const asked = isColour(fill) ? symbol : fill;
  const channels = useMemo<Channels>(() => ({ fill, stroke, symbol }), [fill, stroke, symbol]);

  const hostRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const residentRef = useRef<Resident>(NOBODY);

  const { explore, pending, refresh, resident, slice, sliced, total } = useBoundedGraph({
    debounce,
    fill: asked,
    graphRef,
    hostRef,
    limit,
    onError: onFailure,
    pinned,
    r,
    source,
  });

  /**
   * The resident map, readable from a callback that was created once.
   *
   * Written on every render rather than through an effect: a click handler registered with cosmos.gl
   * at construction reads this on the next gesture, and an effect would leave one frame where the map
   * describes buffers that are no longer on screen.
   */
  residentRef.current = resident;

  const getGraph = useCallback(() => graphRef.current, []);
  const getResident = useCallback(() => residentRef.current, []);

  /**
   * The host's handlers, read through a ref.
   *
   * cosmos.gl takes its callbacks once, at construction, so a fresh `events` object per render would
   * either be ignored or force a rebuild of the WebGL context. The ref is what lets a host pass an
   * inline object without either.
   */
  const live = useRef(events);
  live.current = events;

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const wired = useMemo<CosmosGraphOptions["events"]>(
    () => ({
      onBackgroundClick: () => live.current?.onBackgroundClick?.(),
      onDragEnd: (index) => {
        const vertex = residentRef.current.at(index);
        if (vertex !== undefined) live.current?.onDragEnd?.(vertex);
      },
      onPointClick: (graph, index) => {
        const vertex = residentRef.current.at(index);
        if (vertex !== undefined) live.current?.onPointClick?.(vertex, graph, index);
      },
      onPointerOut: () => live.current?.onPointerOut?.(),
      onPointerOver: (index) => {
        const vertex = residentRef.current.at(index);
        if (vertex !== undefined) live.current?.onPointerOver?.(vertex, index);
      },
      onTick: () => live.current?.onTick?.(),
      // The camera moved, so the graph is re-asked. A host that forgot this line got a canvas that
      // drew its first answer and never asked again — which is what `refresh` being the host's
      // responsibility used to cost.
      onZoom: () => {
        refreshRef.current();
        live.current?.onZoom?.();
      },
    }),
    // Built once: every reference inside is a ref this hook owns, so there is nothing to depend on.
    // It used to close over a ref object a host could substitute, which is the prop this file deletes.
    [],
  );

  /**
   * The renderer, built into an element this hook does not render.
   *
   * That is sound and not a gamble: React attaches refs during the commit phase, before any effect
   * runs, so by the time this effect fires `hostRef.current` is whatever the provider mounted —
   * including when the provider is a child component, since child refs are attached in the same
   * commit. A host that calls `useGraph` and renders no surface at all gets a hook that returns
   * early, forever, which is the honest outcome for a graph with nowhere to go.
   */
  useCosmosGraph({
    clusters,
    events: wired,
    graphRef,
    hostRef,
    onFailure,
    report,
    reportProgress,
    sim,
    simulate,
  });

  useGraphLook({ channels, display, getGraph, hostRef, look, schedule, slice });

  return { explore, getGraph, getResident, hostRef, pending, refresh, resident, slice, sliced, total };
}
