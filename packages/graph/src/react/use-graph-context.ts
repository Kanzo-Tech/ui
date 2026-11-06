"use client";

import { createContext, useContext } from "react";
import type { GraphApi } from "./use-graph";

/**
 * Ark's four, one for one — `useDialog`, `DialogRoot`, `DialogRootProvider`, `useDialogContext`:
 * `useGraph` creates the api, `GraphRoot` is `useGraph` plus the context, `GraphRootProvider` takes
 * an api a host built itself, and `useGraphContext` reads it. The two roots are parts, as Ark's are;
 * the context is the adapter's. The api is stable, so the context never changes value: state is read
 * through `useGraphState`.
 */
export const GraphContext = createContext<GraphApi | null>(null);

/** Strict: outside a root there is nothing to answer with, and a `null` would read as an empty graph. */
export function useGraphContext(): GraphApi {
  const value = useContext(GraphContext);
  if (!value) throw new Error("useGraphContext must be used inside a <GraphRoot> or <GraphRootProvider>");
  return value;
}
