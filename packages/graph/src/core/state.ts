import type { Corpus, Gap, TileAddress, TileMatrixSet } from "@fossil-lang/corpus";
import type { Selection as Crossfilter } from "@kanzo-tech/mosaic";
import type { LookPatch } from "../render/graph-looks";
import type { Sim } from "../render/graph-sim";
import type { Binding, Channels } from "./channels";
import type { VertexId } from "./resident";
import type { TileContent } from "./tile";
import type { Viewport } from "./tile-matrix";
import type { Motion, Selection, SelectionSource, Tool } from "./types";

export interface GraphOptions extends Channels {
  /**
   * The corpus the host opened with fossil's `open`, or the promise of it. A promise is what makes
   * *opening* a state the graph can report; `null` is no corpus at all.
   */
  corpus: Corpus | PromiseLike<Corpus> | null;
  /** The vertex type drawn. The first type with a position when absent. */
  type?: string;
  /** Which column the size ramp is spent on — Plot's `r`. */
  r?: string;
  /** Which column a label and the hover card show — Plot's `title`. */
  title?: string;
  /**
   * What the categorical channel's values are called, keyed by value. For a column the manifest's
   * `channels:` declares, the ordinals rank themselves and this only names them; for one it does not,
   * the keys' order is also the rank, so a colour never moves because a tile arrived.
   */
  categories?: Readonly<Record<string, string>>;
  /** The page's crossfilter: its clauses filter what is read, and the reader's pick is published into it. */
  filterBy?: Crossfilter;
  /** The most marks drawn at once; a coarser zoom is chosen above it. */
  limit?: number;
  /** Form: a patch over this package's own look. Memoise it — its identity is what repaints. */
  look?: LookPatch;
  /** The force coefficients, as a patch over this package's own. */
  sim?: Partial<Sim>;
  /**
   * Runs the live layout while true, from the points' current positions. Off by default: the corpus's
   * positions are drawn as they are. `GraphToolbar` starts and stops the layout whatever this says.
   */
  simulate?: boolean;
  /** Required: unhandled, a browser with no WebGL context shows an empty box. */
  onFailure: (message: string) => void;
  onSelect?: (selection: Selection | null) => void;
  onFocus?: (vertex: VertexId | null) => void;
}

/**
 * Where the graph is in its life. `none` is no corpus; `opening` is a corpus promised and not yet
 * open; `reading` is a tile in view not yet read or not yet drawn; `idle` is everything in view
 * drawn; `failed` is a corpus that would not open, a type it cannot draw, or a canvas that could not
 * start a renderer.
 */
export type GraphStatus = "none" | "opening" | "reading" | "idle" | "failed";

/** What is on the canvas, as the renderer composed it. */
export interface Drawn {
  /** Points drawn — vertices and cells. */
  readonly marks: number;
  /** Vertices those marks stand for: a cell counts its members. */
  readonly represented: number;
  /** What each category rank is: the declared or named values first, then any other seen, in rank order. */
  readonly domain: readonly unknown[];
  /** Per rank, the vertices drawn marks stand for. */
  readonly tally: readonly number[];
}

/** What a host and the parts read, through `useGraphState`. */
export interface GraphState {
  readonly status: GraphStatus;
  /** Vertices of the drawn type, from the manifest — it does not shrink with a filter. */
  readonly total: number | undefined;
  /** The zoom drawn, coarsest `0`; the payload is the last. */
  readonly z: number | null;
  /** Whether a tile in view is still being read. */
  readonly pending: boolean;
  /** What is on the canvas, or `null` before the first composition. */
  readonly drawn: Drawn | null;
  /** The categorical domain before anything is drawn: the manifest's ordinals, or the host's names. */
  readonly domain: readonly unknown[];
  readonly selection: Selection | null;
  readonly focus: VertexId | null;
  readonly hovered: VertexId | null;
  readonly pinned: readonly VertexId[];
  readonly tool: Tool;
  readonly motion: Motion;
  /** How far through settling a live layout is, `0`–`1`. */
  readonly progress: number;
  /** Relations the corpus declined to answer, with fossil's reason. */
  readonly declined: readonly Gap[];
  /** The options as given, with the corpus once it is open. */
  readonly options: GraphOptions;
  readonly corpus: Corpus | null;
}

/** One tile the picture is made of: where it is, and what it holds. */
export interface TileView {
  readonly address: TileAddress;
  readonly kind: "rows" | "cells";
  readonly content: TileContent;
}

/** The state, plus what only the renderer reads. */
export interface GraphSnapshot extends GraphState {
  readonly matrix: TileMatrixSet | null;
  /** The drawn type's position in `corpus.types.vertices` — the type half of a `VertexId`. */
  readonly typeIndex: number;
  readonly binding: Binding;
  /** The payload column a cell's `mode` is the majority of, or `null` where the tree names none. */
  readonly modeColumn: string | null;
  /** Tiles drawn now; the same array until the set changes. */
  readonly visible: readonly TileView[];
  /** Every tile holding content — where a far end is looked up. */
  readonly cached: readonly TileView[];
}

/**
 * **The graph's state, outside React** — TanStack Query's `QueryObserver` shape: `subscribe`,
 * `getSnapshot`, `setOptions`, `destroy`. The snapshot is a new object only when something a reader
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
  /** Whether the canvas has a renderer: without one nothing in view will ever be drawn. */
  setRenderable(renderable: boolean): void;
  /** The renderer drew `visible`; `drawn` is what it composed, or `null` when the set was unchanged. */
  reportDrawn(visible: readonly TileView[], drawn: Drawn | null): void;
}
