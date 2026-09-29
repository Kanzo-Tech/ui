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
import type { MosaicClient, Selection as Crossfilter } from "@kanzo-tech/mosaic";
import type { LookPatch } from "../render/graph-looks";
import type { Sim } from "../render/graph-sim";
import { bindingOf, projectionOf, type Binding, type Channels } from "./channels";
import { filterFor, graphClient, publish } from "./filter";
import { denseOf, type VertexId } from "./resident";
import type { TileContent } from "./tile";
import type { Viewport } from "./tile-matrix";
import { Tileset2D } from "./tileset";
import type { Motion, Selection, SelectionSource, Tool } from "./types";

/** Twenty thousand marks: what a canvas draws at once before a coarser zoom is chosen. */
export const DEFAULT_LIMIT = 20_000;

export interface GraphOptions extends Channels {
  /** The corpus the host opened with fossil's `open`. `null` while it is still opening. */
  corpus: Corpus | null;
  /** The vertex type drawn. The first type with a position when absent. */
  type?: string;
  /** Which column the size ramp is spent on — Plot's `r`. */
  r?: string;
  /** Which column a label and the hover card show — Plot's `title`. */
  title?: string;
  /** The page's crossfilter: its clauses filter what is read, and the reader's pick is published into it. */
  filterBy?: Crossfilter;
  /** The most marks drawn at once; a coarser zoom is chosen above it. */
  limit?: number;
  /** Form: a patch over this package's own look. Memoise it — its identity is what repaints. */
  look?: LookPatch;
  /** The force coefficients, as a patch over this package's own. */
  sim?: Partial<Sim>;
  /** A live layout. Off: a corpus's positions are the index every read is asked against. */
  simulate?: boolean;
  /** Required: unhandled, a browser with no WebGL context shows an empty box. */
  onFailure: (message: string) => void;
  onSelect?: (selection: Selection | null) => void;
  onFocus?: (vertex: VertexId | null) => void;
}

/** One tile the picture is made of: where it is, and what it holds. */
export interface TileView {
  readonly address: TileAddress;
  readonly kind: "rows" | "cells";
  readonly content: TileContent;
}

export interface GraphSnapshot {
  readonly matrix: TileMatrixSet | null;
  /** The drawn type's position in `corpus.types.vertices` — the type half of a `VertexId`. */
  readonly typeIndex: number;
  readonly binding: Binding;
  /** The payload column a cell's `mode` is the majority of, or `null` where the tree names none. */
  readonly modeColumn: string | null;
  /** The zoom the camera is drawn at, or `null` before the first selection. */
  readonly z: number | null;
  /** Tiles drawn now: the selected ones holding content, and best-available stand-ins. */
  readonly visible: readonly TileView[];
  /** Every tile holding content — where a far end is looked up. */
  readonly cached: readonly TileView[];
  /** Whether a selected tile is still being read. */
  readonly pending: boolean;
  /** Vertices of the drawn type, from the manifest; the one number that does not shrink with a filter. */
  readonly total: number | undefined;
  /** Relations the corpus declined to answer, with fossil's reason. */
  readonly declined: readonly Gap[];
  readonly selection: Selection | null;
  readonly focus: VertexId | null;
  readonly hovered: VertexId | null;
  readonly pinned: readonly VertexId[];
  readonly tool: Tool;
  readonly motion: Motion;
  /** How far through settling a live layout is, `0`–`1`. */
  readonly progress: number;
  /** What the renderer last composed, or `null` before it has. */
  readonly drawn: Drawn | null;
}

/** What is on the canvas, as the renderer composed it. */
export interface Drawn {
  /** Points drawn — vertices and cells. */
  readonly marks: number;
  /** Vertices those marks stand for: a cell counts its members. */
  readonly represented: number;
  /** What each category rank is — the values the bound column has shown, in rank order. */
  readonly domain: readonly unknown[];
}

/**
 * **The graph's state, outside React** — TanStack Query's `QueryObserver` shape: `subscribe`,
 * `getSnapshot`, `setOptions`, `destroy`. Tiles arrive, the camera moves and a filter lands at
 * frame rate and none of it is a render; the snapshot is a new object only when something a reader
 * can see changed, and the same object between notifications.
 */
export interface GraphStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): GraphSnapshot;
  getOptions(): GraphOptions;
  setOptions(options: GraphOptions): void;
  destroy(): void;
  /** The camera, from the renderer: the rectangle in view. */
  setViewport(viewport: Viewport): void;
  select(vertices: readonly VertexId[] | null, source?: SelectionSource, label?: string): void;
  focus(vertex: VertexId | null): void;
  hover(vertex: VertexId | null): void;
  pin(vertices: readonly VertexId[]): void;
  setTool(tool: Tool): void;
  report(motion: Motion): void;
  reportProgress(value: number): void;
  reportDrawn(drawn: Drawn): void;
}

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

export function createGraph(initial: GraphOptions): GraphStore {
  let options = initial;
  const listeners = new Set<() => void>();
  const self: MosaicClient = graphClient();

  let matrix: TileMatrixSet | null = null;
  let typeIndex = 0;
  let modeColumn: string | null = null;
  let scan: Scan | null = null;
  let binding = NO_BINDING;
  let filter: Filter | undefined;
  let viewport: Viewport | null = null;
  let declined: Gap[] = [];
  let unlisten: (() => void) | null = null;
  let active = false;
  let lastFrame = -1;

  const fail = (error: unknown) => {
    options.onFailure(error instanceof Error ? error.message : String(error));
  };

  const tileset = new Tileset2D({
    debounceTime: 60,
    load: async (address, signal) => {
      const corpus = options.corpus;
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
    matrix: null,
    typeIndex: 0,
    modeColumn: null,
    binding: NO_BINDING,
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
  };

  const viewOf = (tile: { address: TileAddress; content: TileContent | null }): TileView => ({
    address: tile.address,
    kind: matrix?.tileMatrices[tile.address.z]?.kind ?? "rows",
    content: tile.content as TileContent,
  });

  function notify(patch: Partial<GraphSnapshot> = {}): void {
    lastFrame = tileset.frame;
    const tiles = tileset.tiles.filter((tile) => tile.content !== null);
    snapshot = {
      ...snapshot,
      matrix,
      typeIndex,
      modeColumn,
      binding,
      z: tileset.z,
      visible: tiles.filter((tile) => tile.isVisible).map(viewOf),
      cached: tiles.map(viewOf),
      pending: tileset.selectedTiles.some((tile) => tile.isLoading),
      total: matrix ? Number(matrix.tileMatrices[matrix.tileMatrices.length - 1]?.count ?? 0) : undefined,
      declined,
      ...patch,
    };
    for (const listener of listeners) listener();
  }

  /** A binding or a filter is a new scan, planned once and never per camera move. */
  function rescan(): void {
    const corpus = options.corpus;
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
    const corpus = options.corpus;
    matrix = null;
    scan = null;
    declined = [];
    tileset.finalize();
    if (!corpus) return notify({ selection: null, focus: null, hovered: null, pinned: [], drawn: null });
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
      fail(error);
    }
    snapshot = { ...snapshot, selection: null, focus: null, hovered: null, pinned: [], drawn: null };
    rescan();
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
        reopen();
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
    reportDrawn(drawn) {
      notify({ drawn });
    },
  };

  binding = bindingOf(initial);
  reopen();
  return store;
}
