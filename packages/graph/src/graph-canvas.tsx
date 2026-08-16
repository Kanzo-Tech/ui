"use client";

import { cn } from "@kanzo-tech/ui";
import { createContext, useContext, type ReactNode } from "react";
import { useGraph, type GraphApi, type UseGraphProps } from "./use-graph";

/**
 * The three pieces that turn `useGraph` into something you can put on a page — Ark's shape, minus
 * the part of it that only makes sense when a component has parts.
 *
 * `GraphRootProvider` takes an api built above it and renders the surface. `GraphCanvas` is the
 * shortcut that builds one for you, which is what a host wants until it needs to call a hook beside
 * the canvas. `useGraphContext` is how the chrome reads either of them.
 *
 * **`useGraph` creates and `useGraphContext` reads**, which is the convention Ark states and this
 * package used to invert: the reader was called `useGraphCanvas` and there was no creator at all, so
 * anyone arriving from Ark would have read it as the factory and got the opposite.
 */

const GraphContext = createContext<GraphApi | null>(null);

/**
 * Reach the graph from its chrome. Strict: outside a provider there is nothing to answer with, and a
 * `null` here would surface as a legend that silently counts zero.
 */
export function useGraphContext(): GraphApi {
  const value = useContext(GraphContext);
  if (!value) throw new Error("useGraphContext must be used inside a <GraphCanvas> or <GraphRootProvider>");
  return value;
}

export interface GraphRootProviderProps {
  /** The api from `useGraph`, built wherever the host needs to reach it. */
  value: GraphApi;
  className?: string;
  /** The chrome — a legend, a toolbar, a zoom control. Positioned over the surface by the host. */
  children?: ReactNode;
  slot?: string;
}

/**
 * The element, and the context over it.
 *
 * Two divs rather than one, and the split is load-bearing: cosmos.gl takes the inner one and fills
 * it with a canvas of its own, so chrome parented there would be a sibling of that canvas inside an
 * element the renderer resizes. The outer one is the positioning context — `isolate`, so a host's
 * `z-index` on a legend cannot escape into the page — and `children` go there.
 */
export function GraphRootProvider(props: GraphRootProviderProps) {
  const { children, className, slot, value } = props;
  return (
    <div
      className={cn("relative isolate size-full overflow-hidden", className)}
      data-slot={slot ?? "graph-canvas"}
    >
      <div className="size-full" data-slot="graph-canvas-surface" ref={value.hostRef} />
      <GraphContext.Provider value={value}>{children}</GraphContext.Provider>
    </div>
  );
}

export interface GraphCanvasProps extends UseGraphProps {
  className?: string;
  children?: ReactNode;
  slot?: string;
}

/**
 * A bounded WebGL graph, wired.
 *
 * **This is `ChartRoot`'s counterpart, and it is deliberately not the whole screen.** It owns the
 * renderer's lifetime, the query loop that follows the camera, and the buffers a look implies — the
 * three that are the same in every product and were being re-wired by hand at each call site.
 * Everything else stays where it differs: a legend, an inspector, a hover card and a rule builder are
 * arrangements, and `children` is where they go.
 *
 * **Overlays and selection are not in here on purpose.** `useGraphOverlays` and `useGraphSelection`
 * need callbacks only the product can write — what a click means, what a lasso commits to. They also
 * need `getGraph` and `getResident` from *above* this element, where a context cannot be read, which
 * is the whole reason `useGraph` and `GraphRootProvider` exist beside this shortcut. A host with
 * overlays calls those two; a host with only chrome calls this one and reads `useGraphContext` from
 * a child.
 *
 * This component exists against an earlier decision that there should be no canvas component, and
 * `decisions/a-canvas-component-owns-the-three-that-never-differ.md` carries what changed and what
 * would reverse it.
 */
export function GraphCanvas(props: GraphCanvasProps) {
  const { children, className, slot, ...rest } = props;
  const api = useGraph(rest);
  return (
    <GraphRootProvider className={className} slot={slot} value={api}>
      {children}
    </GraphRootProvider>
  );
}
