"use client";

import type { ReactNode } from "react";
import { GraphContext } from "../react/use-graph-context";
import { useGraph, type GraphApi, type UseGraphProps } from "../react/use-graph";
import { GraphSection } from "./graph-section";

export interface GraphRootProviderProps {
  /** The api from `useGraph`, built where the host needs to hold it. */
  value: GraphApi;
  children?: ReactNode;
}

/**
 * The context, and the graph's section owner under it: whatever sits beneath a root — a settings
 * tab, a dock, one `<Pref>` — draws the graph's preferences with the graph's columns in hand.
 */
export function GraphRootProvider({ children, value }: GraphRootProviderProps) {
  return (
    <GraphContext.Provider value={value}>
      <GraphSection>{children}</GraphSection>
    </GraphContext.Provider>
  );
}

export interface GraphRootProps extends UseGraphProps {
  children?: ReactNode;
}

export function GraphRoot({ children, ...props }: GraphRootProps) {
  const api = useGraph(props);
  return <GraphRootProvider value={api}>{children}</GraphRootProvider>;
}
