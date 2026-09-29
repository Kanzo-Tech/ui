import {
  PAYLOAD_ADDRESS,
  PAYLOAD_COORDINATES,
  type Corpus,
  type Filter,
  type Gap,
  type Scan,
  type TileAddress,
  type TileMatrixSet,
} from "@fossil-lang/corpus";
import type { MosaicClient } from "@kanzo-tech/mosaic";
import { domainOf } from "./categories";
import { bindingOf, projectionOf, type Binding } from "./channels";
import { filterFor, graphClient, publish } from "./filter";
import { denseOf } from "./resident";
import type { GraphOptions, GraphSnapshot, GraphStatus, GraphStore, TileView } from "./state";
import type { TileContent } from "./tile";
import type { Viewport } from "./tile-matrix";
import { Tileset2D } from "./tileset";

export type { Drawn, GraphOptions, GraphSnapshot, GraphState, GraphStatus, GraphStore, TileView } from "./state";

/** Twenty thousand marks: what a canvas draws at once before a coarser zoom is chosen. */
export const DEFAULT_LIMIT = 20_000;

const NO_BINDING: Binding = bindingOf({});
const KEY = PAYLOAD_ADDRESS[0] as string;

function bytesOf(content: Omit<TileContent, "byteLength">): number {
  let bytes = 0;
  for (const edge of content.edges) bytes += edge.src.byteLength + edge.dst.byteLength + (edge.weight?.byteLength ?? 0);
  return bytes + content.rows.numRows * 8 * 4;
}

const sameFilter = (a: Filter | undefined, b: Filter | undefined) =>
  JSON.stringify(a, (_, v: unknown) => (typeof v === "bigint" ? `${v}n` : v)) ===
  JSON.stringify(b, (_, v: unknown) => (typeof v === "bigint" ? `${v}n` : v));

const isPromise = (value: unknown): value is PromiseLike<Corpus> =>
  typeof (value as PromiseLike<Corpus> | null)?.then === "function";

/** The same array while the set of tiles in it is the same, so a reader can compare by identity. */
function keep(previous: readonly TileView[], next: TileView[]): readonly TileView[] {
  if (previous.length !== next.length) return next;
  return next.every((view, i) => view.content === previous[i]?.content) ? previous : next;
}

export function createGraph(initial: GraphOptions): GraphStore {
  let options = initial;
  const listeners = new Set<() => void>();
  const self: MosaicClient = graphClient();

  let corpus: Corpus | null = null;
  let opening: PromiseLike<Corpus> | null = null;
  let failed = false;
  let unrenderable = false;
  let matrix: TileMatrixSet | null = null;
  let typeIndex = 0;
  let modeColumn: string | null = null;
  let scan: Scan | null = null;
  let binding = NO_BINDING;
  let filter: Filter | undefined;
  let viewport: Viewport | null = null;
  let declined: Gap[] = [];
  let composed: readonly TileView[] | null = null;
  let unlisten: (() => void) | null = null;
  let active = false;
  let lastFrame = -1;

  const fail = (error: unknown) => {
    options.onFailure(error instanceof Error ? error.message : String(error));
  };

  const tileset = new Tileset2D({
    debounceTime: 60,
    load: async (address, signal) => {
      if (!corpus || !scan) throw new Error("the graph has no scan to read with");
      const rows = await scan.read(address, { signal });
      const cells = matrix?.tileMatrices[address.z]?.kind === "cells";
      const src = await corpus.edges({ from: address, direction: "src", signal });
      const dst = cells ? null : await corpus.edges({ from: address, direction: "dst", signal });
      const edges = [...src.batches, ...(dst?.batches ?? [])];
      const gaps = [...src.declined, ...(dst?.declined ?? [])].filter((gap) => !(cells && gap.direction === "dst"));
      const content = { rows, edges, declined: gaps };
      return { ...content, byteLength: bytesOf(content) };
    },
    onTileLoad: (tile) => {
      for (const gap of tile.content?.declined ?? []) {
        if (!declined.some((d) => d.edgeType === gap.edgeType && d.direction === gap.direction)) {
          declined = [...declined, gap];
        }
      }
      tileset.refresh();
      notify();
    },
    onTileError: (error) => {
      tileset.refresh();
      fail(error);
      notify();
    },
  });

  let snapshot: GraphSnapshot = {
    status: "none",
    matrix: null,
    typeIndex: 0,
    modeColumn: null,
    binding: NO_BINDING,
    domain: [],
    z: null,
    visible: [],
    cached: [],
    pending: false,
    total: undefined,
    declined: [],
    selection: null,
    focus: null,
    hovered: null,
    pinned: [],
    tool: null,
    motion: "settled",
    progress: 1,
    drawn: null,
    options,
    corpus: null,
  };

  const viewOf = (tile: { address: TileAddress; content: TileContent | null }): TileView => ({
    address: tile.address,
    kind: matrix?.tileMatrices[tile.address.z]?.kind ?? "rows",
    content: tile.content as TileContent,
  });

  let domain: { key: unknown[]; value: readonly unknown[] } = { key: [], value: [] };
  function domainNow(): readonly unknown[] {
    const key = [corpus, typeIndex, binding.category, options.categories];
    if (key.some((part, i) => part !== domain.key[i])) domain = { key, value: domainOf(corpus, typeIndex, binding, options.categories) };
    return domain.value;
  }

  function statusOf(pending: boolean, visible: readonly TileView[]): GraphStatus {
    if (failed || unrenderable) return "failed";
    if (opening) return "opening";
    if (!corpus) return "none";
    return pending || composed !== visible || snapshot.drawn === null ? "reading" : "idle";
  }

  function notify(patch: Partial<GraphSnapshot> = {}): void {
    lastFrame = tileset.frame;
    const tiles = tileset.tiles.filter((tile) => tile.content !== null);
    const visible = keep(snapshot.visible, tiles.filter((tile) => tile.isVisible).map(viewOf));
    const pending = tileset.selectedTiles.some((tile) => tile.isLoading);
    snapshot = {
      ...snapshot,
      matrix,
      typeIndex,
      modeColumn,
      binding,
      domain: domainNow(),
      z: tileset.z,
      visible,
      cached: keep(snapshot.cached, tiles.map(viewOf)),
      pending,
      total: matrix ? Number(matrix.tileMatrices[matrix.tileMatrices.length - 1]?.count ?? 0) : undefined,
      declined,
      options,
      corpus,
      ...patch,
    };
    snapshot = { ...snapshot, status: statusOf(pending, snapshot.visible) };
    for (const listener of listeners) listener();
  }

  /** A binding or a filter is a new scan, planned once and never per camera move. */
  function rescan(): void {
    if (!corpus || !matrix) return;
    try {
      const fixed = [KEY, ...PAYLOAD_COORDINATES];
      scan = corpus.scan({ type: matrix.type, filter, select: projectionOf(binding, fixed) });
      tileset.setPlan(scan.plan());
    } catch (error) {
      scan = null;
      tileset.setPlan([]);
      fail(error);
    }
    tileset.reloadAll();
    if (viewport) tileset.update(viewport, options.limit ?? DEFAULT_LIMIT);
    notify();
  }

  function reopen(): void {
    failed = false;
    matrix = null;
    scan = null;
    declined = [];
    composed = null;
    tileset.finalize();
    const cleared = { selection: null, focus: null, hovered: null, pinned: [], drawn: null };
    if (!corpus) return notify(cleared);
    const types = corpus.types.vertices;
    const type = options.type ?? types.find((t) => t.geometry)?.type ?? types[0]?.type;
    typeIndex = Math.max(0, types.findIndex((t) => t.type === type));
    try {
      if (type === undefined) throw new Error("the corpus has no vertex type to draw");
      matrix = corpus.tileMatrix(type);
      const mode = corpus.addressing.vertexType(type).cells?.modeChannel ?? null;
      modeColumn = types[typeIndex]?.channels.find((channel) => channel.name === mode)?.column ?? null;
      tileset.setMatrix(matrix);
    } catch (error) {
      failed = true;
      fail(error);
    }
    snapshot = { ...snapshot, ...cleared };
    rescan();
  }

  /** A promise is adopted when it settles, and only if it is still the corpus the host means. */
  function adopt(given: GraphOptions["corpus"]): void {
    corpus = null;
    opening = isPromise(given) ? given : null;
    if (!opening) {
      corpus = given as Corpus | null;
      return reopen();
    }
    const promised = opening;
    reopen();
    promised.then(
      (opened) => {
        if (opening !== promised) return;
        opening = null;
        corpus = opened;
        reopen();
      },
      (error: unknown) => {
        if (opening !== promised) return;
        opening = null;
        failed = true;
        fail(error);
        notify();
      },
    );
  }

  function listen(): void {
    unlisten?.();
    unlisten = null;
    const crossfilter = options.filterBy;
    const refilter = () => {
      let next: Filter | undefined;
      try {
        next = crossfilter ? filterFor(crossfilter, self) : undefined;
      } catch (error) {
        fail(error);
        return;
      }
      if (sameFilter(next, filter)) return;
      filter = next;
      rescan();
    };
    if (crossfilter) {
      crossfilter.addEventListener("value", refilter);
      unlisten = () => crossfilter.removeEventListener("value", refilter);
    }
    refilter();
  }

  const store: GraphStore = {
    /**
     * The first subscriber starts listening to the crossfilter and the last one stops it and lets the
     * tiles go — `QueryObserver`'s `onSubscribe`/`onUnsubscribe`, which is what survives StrictMode
     * mounting everything twice.
     */
    subscribe(listener) {
      listeners.add(listener);
      if (!active) {
        active = true;
        listen();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) store.destroy();
      };
    },
    getSnapshot: () => snapshot,
    getOptions: () => options,
    setOptions(next) {
      const previous = options;
      options = next;
      const nextBinding = bindingOf(next);
      const rebound =
        nextBinding.category !== binding.category ||
        nextBinding.size !== binding.size ||
        nextBinding.title !== binding.title;
      binding = nextBinding;
      if (next.corpus !== previous.corpus || next.type !== previous.type) {
        if (next.corpus !== previous.corpus) adopt(next.corpus);
        else reopen();
        if (active && next.filterBy !== previous.filterBy) listen();
        return;
      }
      if (active && next.filterBy !== previous.filterBy) listen();
      if (rebound) return rescan();
      if (next.limit !== previous.limit && viewport) tileset.update(viewport, next.limit ?? DEFAULT_LIMIT);
      notify();
    },
    destroy() {
      active = false;
      unlisten?.();
      unlisten = null;
      tileset.finalize();
      listeners.clear();
    },
    setViewport(next) {
      viewport = next;
      if (tileset.update(next, options.limit ?? DEFAULT_LIMIT) !== lastFrame) notify();
    },
    select(vertices, source = "node", label = "") {
      const selection = vertices && vertices.length > 0 ? { vertices: [...vertices], source, label } : null;
      notify({ selection });
      options.onSelect?.(selection);
      if (options.filterBy) publish(options.filterBy, self, KEY, selection ? selection.vertices.map(denseOf) : null);
    },
    focus(vertex) {
      if (vertex === snapshot.focus) return;
      notify({ focus: vertex });
      options.onFocus?.(vertex);
    },
    hover(vertex) {
      if (vertex !== snapshot.hovered) notify({ hovered: vertex });
    },
    pin(vertices) {
      notify({ pinned: [...vertices] });
    },
    setTool(tool) {
      if (tool !== snapshot.tool) notify({ tool });
    },
    report(motion) {
      if (motion !== snapshot.motion) notify({ motion });
    },
    reportProgress(value) {
      if (value !== snapshot.progress) notify({ progress: value });
    },
    setRenderable(renderable) {
      if (unrenderable === !renderable) return;
      unrenderable = !renderable;
      notify();
    },
    reportDrawn(visible, drawn) {
      if (composed === visible && drawn === null) return;
      composed = visible;
      notify(drawn ? { drawn } : {});
    },
  };

  binding = bindingOf(initial);
  adopt(initial.corpus);
  return store;
}
