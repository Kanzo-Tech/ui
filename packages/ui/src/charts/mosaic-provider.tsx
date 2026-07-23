"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Selection, coordinator as setActiveCoordinator, type Coordinator } from "@uwdata/mosaic-core";

/**
 * MosaicProvider — the crossfilter context every chart on this subpath reads from.
 *
 * **Bring-your-own coordinator**, the way CodeEditor is bring-your-own-language. The package
 * never instantiates a `Coordinator` and never imports DuckDB-WASM: the consumer builds the
 * coordinator over their own backend (`wasmConnector()` + `new Coordinator(connector)`, a
 * socket/REST connector, a shared worker…) and passes it in. That single decision is what keeps
 * DuckDB-WASM out of the library bundle and out of any React Server Component — the whole boot
 * lives in the consumer's `"use client"` island.
 *
 * The provider does two things: it registers the caller's coordinator as vgplot's active one, so
 * `vg.plot(...)` marks resolve their queries through it, and it hands every descendant chart a
 * shared `Selection.crossfilter()` so brushing one chart filters the others.
 */

export interface MosaicContextValue {
  /** The caller-supplied coordinator. Also registered as vgplot's active coordinator. */
  coordinator: Coordinator;
  /** The shared crossfilter selection every chart publishes to and filters by. */
  crossfilter: Selection;
}

const MosaicContext = createContext<MosaicContextValue | null>(null);

export interface MosaicProviderProps {
  /**
   * The Mosaic `Coordinator`, constructed by the caller over their own DuckDB / connector.
   * The package never builds one — see the module note.
   */
  coordinator: Coordinator;
  /**
   * The crossfilter `Selection` every descendant chart shares. Defaults to a fresh
   * `Selection.crossfilter()`; pass one to share a selection across trees or to seed a predicate.
   */
  crossfilter?: Selection;
  children: ReactNode;
}

export function MosaicProvider({ coordinator, crossfilter, children }: MosaicProviderProps) {
  const value = useMemo<MosaicContextValue>(() => {
    // Register the caller's coordinator as vgplot's active one. `coordinator(instance)` is
    // mosaic-core's global setter — the same call keasy's boot makes, except the instance
    // arrives as a prop here instead of being built in the library.
    setActiveCoordinator(coordinator);
    return { coordinator, crossfilter: crossfilter ?? Selection.crossfilter() };
  }, [coordinator, crossfilter]);

  return <MosaicContext.Provider value={value}>{children}</MosaicContext.Provider>;
}

/** The Mosaic context — coordinator + shared crossfilter. Throws outside a `<MosaicProvider>`. */
export function useMosaic(): MosaicContextValue {
  const ctx = useContext(MosaicContext);
  if (!ctx) throw new Error("useMosaic must be used within a <MosaicProvider>.");
  return ctx;
}

/** The shared crossfilter `Selection` — the value a chart brushes into by default. */
export function useCrossfilter(): Selection {
  return useMosaic().crossfilter;
}
