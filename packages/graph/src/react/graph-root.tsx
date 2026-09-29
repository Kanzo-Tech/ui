"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useGraph, type GraphApi, type UseGraphProps } from "./use-graph";

/**
 * Ark's four, one for one — `useDialog`, `DialogRoot`, `DialogRootProvider`, `useDialogContext`:
 * `useGraph` creates the api, `GraphRoot` is `useGraph` plus the context, `GraphRootProvider` takes
 * an api a host built itself, and `useGraphContext` reads it. Neither root renders an element; the
 * canvas is a part. The api is stable, so the context never changes value: state is read through
 * `useGraphState`.
 */
const GraphContext = createContext<GraphApi | null>(null);

/** Strict: outside a root there is nothing to answer with, and a `null` would read as an empty graph. */
export function useGraphContext(): GraphApi {
  const value = useContext(GraphContext);
  if (!value) throw new Error("useGraphContext must be used inside a <GraphRoot> or <GraphRootProvider>");
  return value;
}

export interface GraphRootProviderProps {
  /** The api from `useGraph`, built where the host needs to hold it. */
  value: GraphApi;
  children?: ReactNode;
}

export function GraphRootProvider({ children, value }: GraphRootProviderProps) {
  return <GraphContext.Provider value={value}>{children}</GraphContext.Provider>;
}

export interface GraphRootProps extends UseGraphProps {
  children?: ReactNode;
}

export function GraphRoot({ children, ...props }: GraphRootProps) {
  const api = useGraph(props);
  return <GraphRootProvider value={api}>{children}</GraphRootProvider>;
}
