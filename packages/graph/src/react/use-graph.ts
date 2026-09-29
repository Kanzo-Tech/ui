"use client";

import type { Graph } from "@cosmos.gl/graph";
import type { Gap } from "@fossil-lang/corpus";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Resident, VertexId } from "../core/resident";
import { createGraph, type Drawn, type GraphOptions, type GraphStore } from "../core/store";
import type { GraphCommands, Motion, Selection, SelectionSource, Tool } from "../core/types";
import { createRenderer, type Renderer, type RendererEvents } from "../render/renderer";

export type UseGraphProps = GraphOptions;

/**
 * What a graph publishes to its parts and its host: the store's snapshot, the commands, and the two
 * readers a callback registered once needs.
 */
export interface GraphApi extends GraphCommands {
  /** Vertices of the drawn type, from the manifest — it does not shrink with a filter. */
  readonly total: number | undefined;
  /** The zoom drawn, coarsest `0`; the payload is the last. */
  readonly z: number | null;
  /** Whether a tile in view is still being read. */
  readonly pending: boolean;
  /** What is on the canvas, or `null` before the first composition. */
  readonly drawn: Drawn | null;
  readonly selection: Selection | null;
  readonly focus: VertexId | null;
  readonly hovered: VertexId | null;
  readonly pinned: readonly VertexId[];
  readonly tool: Tool;
  readonly motion: Motion;
  readonly progress: number;
  /** Relations the corpus declined to answer, with fossil's reason. */
  readonly declined: readonly Gap[];
  /** The bindings, as given. */
  readonly options: UseGraphProps;
  select(vertices: readonly VertexId[] | null, source?: SelectionSource, label?: string): void;
  setFocus(vertex: VertexId | null): void;
  setTool(tool: Tool): void;
  /** The renderer, from inside a callback created once. `null` until a canvas is attached. */
  getGraph(): Graph | null;
  getResident(): Resident;
  /** Mount the renderer into an element; `GraphCanvas` does. Returns the detach. */
  attach(host: HTMLDivElement, events?: RendererEvents): () => void;
  /** The renderer itself, for the parts in this package. */
  getRenderer(): Renderer | null;
}

/**
 * **`useBaseQuery`'s three moves**: the store is created once in `useState`, subscribed with
 * `useSyncExternalStore`, and handed the latest props with `setOptions` in an effect — whose
 * dependencies are the props themselves, so a render that changed none does not reach it. Callbacks
 * are read through a ref, so a host's inline `onFailure` is never a change of options.
 */
export function useGraph(props: UseGraphProps): GraphApi {
  const latest = useRef(props);
  latest.current = props;
  const forward = useCallback(
    (options: UseGraphProps): UseGraphProps => ({
      ...options,
      onFailure: (message) => latest.current.onFailure(message),
      onSelect: (selection) => latest.current.onSelect?.(selection),
      onFocus: (vertex) => latest.current.onFocus?.(vertex),
    }),
    [],
  );
  const [store] = useState<GraphStore>(() => createGraph(forward(props)));

  const { corpus, fill, filterBy, limit, look, r, sim, simulate, stroke, symbol, title, type } = props;
  useEffect(() => {
    store.setOptions(forward(latest.current));
  }, [store, forward, corpus, fill, filterBy, limit, look, r, sim, simulate, stroke, symbol, title, type]);

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const renderer = useRef<Renderer | null>(null);
  const attach = useCallback(
    (host: HTMLDivElement, events?: RendererEvents) => {
      const mounted = createRenderer(host, store, events);
      renderer.current = mounted;
      return () => {
        mounted?.destroy();
        if (renderer.current === mounted) renderer.current = null;
      };
    },
    [store],
  );

  const commands = useMemo(() => {
    const on = <K extends keyof GraphCommands>(name: K) =>
      ((...args: Parameters<GraphCommands[K]>) =>
        (renderer.current?.[name] as ((...a: Parameters<GraphCommands[K]>) => void) | undefined)?.(...args)) as GraphCommands[K];
    return {
      zoomBy: on("zoomBy"),
      fit: on("fit"),
      pause: on("pause"),
      resume: on("resume"),
      restart: on("restart"),
      unpin: on("unpin"),
      reveal: on("reveal"),
      frameSelection: on("frameSelection"),
      clear: () => {
        store.select(null);
        store.focus(null);
      },
      select: (vertices: readonly VertexId[] | null, source?: SelectionSource, label?: string) =>
        store.select(vertices, source, label),
      setFocus: (vertex: VertexId | null) => store.focus(vertex),
      setTool: (tool: Tool) => store.setTool(tool),
      getGraph: () => renderer.current?.graph ?? null,
      getResident: () => renderer.current?.resident() ?? NOBODY,
      getRenderer: () => renderer.current,
      attach,
    };
  }, [attach, store]);

  return useMemo<GraphApi>(
    () => ({
      ...commands,
      total: snapshot.total,
      z: snapshot.z,
      pending: snapshot.pending,
      drawn: snapshot.drawn,
      selection: snapshot.selection,
      focus: snapshot.focus,
      hovered: snapshot.hovered,
      pinned: snapshot.pinned,
      tool: snapshot.tool,
      motion: snapshot.motion,
      progress: snapshot.progress,
      declined: snapshot.declined,
      options: store.getOptions(),
    }),
    [commands, snapshot, store],
  );
}

const NOBODY: Resident = {
  size: 0,
  indexOf: () => undefined,
  at: () => undefined,
  indicesOf: () => [],
  verticesAt: () => [],
};
