"use client";

import { useRef, useSyncExternalStore } from "react";
import type { GraphState } from "../core/store";
import { useGraphContext } from "./graph-root";

/**
 * **A slice of the graph's state, and a render only when that slice moves** — TanStack Store's
 * `useStore(store, selector)`, over the root in context. The state changes at frame rate — a hover, a
 * tile, a tick of the layout — so reading all of it would re-render a toolbar on every hover.
 *
 * The selection is kept while the snapshot is the same object, and while `isEqual` says the new slice
 * equals the last one, so a selector may build an object as long as it passes a comparison for it.
 */
export function useGraphState<T>(selector: (state: GraphState) => T, isEqual: (a: T, b: T) => boolean = Object.is): T {
  const api = useGraphContext();
  const memo = useRef<{ state: GraphState; value: T } | null>(null);
  const read = () => {
    const state = api.getState();
    const last = memo.current;
    if (last && last.state === state) return last.value;
    const value = selector(state);
    if (last && isEqual(last.value, value)) {
      memo.current = { state, value: last.value };
      return last.value;
    }
    memo.current = { state, value };
    return value;
  };
  return useSyncExternalStore(api.subscribe, read, read);
}
