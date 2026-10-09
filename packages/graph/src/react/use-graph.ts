"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createGraph, type GraphOptions, type GraphState, type GraphStore } from "../core/store";
import type { GraphCommands, Tool, VertexId } from "../core/types";
import { createRenderer, type Renderer, type RendererEvents } from "../render/renderer";

export type UseGraphProps = GraphOptions;

/**
 * **The commands, and the door to the state — stable for the life of the root.** Zag's split of an
 * api from its state, in TanStack Store's shape: the state is read through `useGraphState(selector)`
 * so a part re-renders on what it shows, and a host holding the api never re-renders because a
 * vertex was hovered.
 */
export interface GraphApi extends GraphCommands {
  setFocus(vertex: VertexId | null): void;
  setTool(tool: Tool): void;
  subscribe(listener: () => void): () => void;
  /** The state now, for a callback; a render reads it with `useGraphState`. */
  getState(): GraphState;
}

/** What the parts in this package reach and a host does not: the element and the renderer. */
interface Internals {
  store: GraphStore;
  attach(host: HTMLDivElement, events?: RendererEvents): () => void;
  renderer(): Renderer | null;
}

const INTERNALS = new WeakMap<GraphApi, Internals>();

/** The parts' door to the renderer. Not on the barrel, and not on `GraphApi`'s type. */
export function internalsOf(api: GraphApi): Internals {
  const found = INTERNALS.get(api);
  if (!found) throw new Error("a graph part was given an api useGraph did not build");
  return found;
}

/**
 * **`useBaseQuery`'s three moves**: the store is created once in `useState`, handed the latest props
 * with `setOptions` in an effect — whose dependencies are the props themselves, so a render that
 * changed none does not reach it — and read through `useSyncExternalStore`, in `useGraphState`.
 * Callbacks are read through a ref, so a host's inline `onFailure` is never a change of options.
 */
export function useGraph(props: UseGraphProps): GraphApi {
  const latest = useRef(props);
  latest.current = props;
  const forward = useCallback(
    (options: UseGraphProps): UseGraphProps => ({
      ...options,
      onFailure: (error) => latest.current.onFailure(error),
      onSelect: (selection) => latest.current.onSelect?.(selection),
      onFocus: (vertex) => latest.current.onFocus?.(vertex),
    }),
    [],
  );
  const [api] = useState<GraphApi>(() => build(createGraph(forward(props))));
  const { store } = internalsOf(api);

  const { categories, cluster, coordinator, fill, filterBy, from, look, r, sim, simulate, stroke, symbol, title, x, y } = props;
  useEffect(() => {
    store.setOptions(forward(latest.current));
  }, [store, forward, categories, cluster, coordinator, fill, filterBy, from, look, r, sim, simulate, stroke, symbol, title, x, y]);

  // Subscribed here as well as by the parts, so the store's first-subscriber and last-subscriber
  // moves follow the root's lifetime and not whichever part happened to mount first.
  useEffect(() => store.subscribe(() => {}), [store]);

  return api;
}

function build(store: GraphStore): GraphApi {
  let renderer: Renderer | null = null;
  const on =
    <K extends keyof GraphCommands>(name: K) =>
    (...args: Parameters<GraphCommands[K]>) =>
      (renderer?.[name] as ((...a: Parameters<GraphCommands[K]>) => void) | undefined)?.(...args);
  const api: GraphApi = {
    zoomBy: on("zoomBy"),
    fit: on("fit"),
    pause: on("pause"),
    resume: on("resume"),
    restart: on("restart"),
    // Selecting and focusing are state, and hold without a renderer; centring is the camera's.
    reveal: (vertex) => {
      if (renderer) return renderer.reveal(vertex);
      store.select([vertex], "node", "Node");
      store.focus(vertex);
    },
    frame: on("frame"),
    clear: () => {
      store.select(null);
      store.focus(null);
    },
    setFocus: (vertex) => store.focus(vertex),
    setTool: (tool) => store.setTool(tool),
    subscribe: (listener) => store.subscribe(listener),
    getState: () => store.getSnapshot(),
  };
  INTERNALS.set(api, {
    store,
    renderer: () => renderer,
    attach(host, events) {
      store.renderable();
      let mounted: Renderer | null = null;
      try {
        mounted = createRenderer(host, store, events);
      } catch (error) {
        store.unrenderable(error);
      }
      renderer = mounted;
      return () => {
        mounted?.destroy();
        if (renderer === mounted) renderer = null;
      };
    },
  });
  return api;
}

