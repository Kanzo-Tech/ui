"use client";

import type { Graph } from "@cosmos.gl/graph";
import { cn } from "@kanzo-tech/ui";
import { createContext, useCallback, useContext, useRef, type ReactNode } from "react";
import type { BoundedSource, Slice } from "./bounded";
import { LOOKS, type Look } from "./graph-looks";
import { residentOf, type Resident, type VertexId } from "./resident";
import type { Display, Motion, Sim } from "./types";
import { useBoundedGraph } from "./use-bounded-graph";
import { useCosmosGraph, type CosmosGraphOptions } from "./use-cosmos-graph";
import { useGraphLook } from "./use-graph-look";

/**
 * What the canvas knows and its chrome has to ask for.
 *
 * Getters rather than values for the two that change every answer: a legend, an inspector and a
 * hover card all read the graph and the resident map from inside callbacks, and publishing them as
 * values would re-render every consumer on every camera move to hand back a reference they only
 * dereference when something is clicked. `slice` IS a value, because a legend counts what is drawn
 * and has to re-render when that changes.
 */
export interface GraphCanvasContextValue {
  getGraph: () => Graph | null;
  getResident: () => Resident;
  slice: Slice | null;
  resident: Resident;
  total: number | undefined;
  pending: boolean;
  sliced: boolean;
  refresh: () => void;
  explore: (seeds: VertexId[], depth: number) => void;
}

const GraphCanvasContext = createContext<GraphCanvasContextValue | null>(null);

/** The empty answer, built once — a ref has to hold something before the first slice arrives. */
const NOBODY = residentOf(null);

/**
 * Reach the canvas from its chrome. Strict: outside a `GraphCanvas` there is nothing to answer with,
 * and a `null` here would surface as a legend that silently counts zero.
 */
export function useGraphCanvas(): GraphCanvasContextValue {
  const value = useContext(GraphCanvasContext);
  if (!value) throw new Error("useGraphCanvas must be used inside a <GraphCanvas>");
  return value;
}

export interface GraphCanvasProps {
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
  /** Vertices that stay drawn whatever the camera is over. */
  pinned?: VertexId[];
  limit?: number;
  lodThreshold?: number;
  debounce?: number;
  /**
   * Required, and the only one.
   *
   * Its silence is a defect rather than a choice: unhandled, a browser with no WebGL context shows
   * an empty box and says nothing, and what stands in its place is the host's decision.
   */
  onFailure: (message: string) => void;
  events?: CosmosGraphOptions["events"];
  report?: (motion: Motion) => void;
  reportProgress?: (value: number) => void;
  className?: string;
  /** The chrome — a legend, a toolbar, a zoom control. Positioned over the surface by the host. */
  children?: ReactNode;
  slot?: string;
}

/**
 * A bounded WebGL graph, wired.
 *
 * **This is `ChartRoot`'s counterpart, and it is deliberately not the whole screen.** It owns the
 * renderer's lifetime, the query loop that follows the camera, and the buffers a look implies —
 * the three that are the same in every product and were being re-wired by hand at each call site.
 * Everything else stays where it differs: a legend, an inspector, a hover card and a rule builder
 * are arrangements, and `children` is where they go.
 *
 * **Overlays and selection are not in here on purpose.** `useGraphOverlays` and `useGraphSelection`
 * need callbacks only the product can write — what a click means, what a lasso commits to — so they
 * stay hooks a host calls with `getGraph` and `getResident` off this context. Folding them in would
 * have meant inventing a policy for both.
 *
 * This component exists against an earlier decision that there should be no canvas component, and
 * `decisions/a-canvas-component-owns-the-three-that-never-differ.md` carries what changed and what
 * would reverse it.
 */
export function GraphCanvas(props: GraphCanvasProps) {
  const {
    children,
    className,
    clusters,
    debounce,
    display,
    events,
    limit,
    lodThreshold,
    look = LOOKS.atlas,
    onFailure,
    pinned,
    report,
    reportProgress,
    sim,
    simulate = false,
    slot,
    source,
  } = props;

  const hostRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);

  const { explore, pending, refresh, resident, slice, sliced, total } = useBoundedGraph({
    debounce,
    graphRef,
    hostRef,
    limit,
    lodThreshold,
    onError: onFailure,
    pinned,
    source,
  });

  /**
   * The resident map, readable from a callback that was created once.
   *
   * Written on every render rather than through an effect: a click handler registered with
   * cosmos.gl at construction reads this on the next gesture, and an effect would leave one frame
   * where the map describes buffers that are no longer on screen.
   */
  const residentRef = useRef<Resident>(NOBODY);
  residentRef.current = resident;

  const getGraph = useCallback(() => graphRef.current, []);
  const getResident = useCallback(() => residentRef.current, []);

  useCosmosGraph({
    clusters,
    events,
    graphRef,
    hostRef,
    onFailure,
    report,
    reportProgress,
    sim,
    simulate,
  });

  useGraphLook({ display, getGraph, hostRef, look, slice });

  return (
    <div
      className={cn("relative isolate size-full overflow-hidden", className)}
      data-slot={slot ?? "graph-canvas"}
    >
      <div className="size-full" data-slot="graph-canvas-surface" ref={hostRef} />
      <GraphCanvasContext.Provider
        value={{ explore, getGraph, getResident, pending, refresh, resident, slice, sliced, total }}
      >
        {children}
      </GraphCanvasContext.Provider>
    </div>
  );
}
