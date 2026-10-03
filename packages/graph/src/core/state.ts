import type { Coordinator, Selection as Crossfilter } from "@kanzo-tech/mosaic";
import type { LookPatch } from "../render/graph-looks";
import type { Sim } from "../render/graph-sim";
import type { Binding, Channels } from "./channels";
import type { Encoding, Geometry } from "./load";
import type { Structure } from "./source";
import type { Motion, Selection, SelectionSource, Tool, VertexId } from "./types";

export interface GraphOptions extends Channels {
  /**
   * The catalog fossil's `open` attached the corpus under — its tables, `fossil_tables` and
   * `fossil_columns` — or `null` for none yet. The graph reads it through `coordinator`.
   */
  from: string | null;
  /** The page's Mosaic coordinator: the one connection every chart and the graph read through. */
  coordinator: Coordinator | null;
  /** Which column the size ramp is spent on — Plot's `r`. */
  r?: string;
  /** Which column a label and the hover card show — Plot's `title`. Absent, each table's `identity`. */
  title?: string;
  /**
   * What the categorical channel's values are called, keyed by value; the keys' order is also the
   * rank, so a colour never moves because a row arrived. With colour by type, the keys are table names.
   */
  categories?: Readonly<Record<string, string>>;
  /** The page's crossfilter: its clauses filter what is drawn, and the reader's pick is published into it. */
  filterBy?: Crossfilter;
  /** Form: a patch over this package's own look. Memoise it — its identity is what repaints. */
  look?: LookPatch;
  /** The force coefficients, as a patch over this package's own. */
  sim?: Partial<Sim>;
  /**
   * Whether the layout runs. By default it does exactly when `x` and `y` are unbound — Cosmograph's
   * rule: bound columns place the points and nothing else does. `GraphToolbar` starts and stops the
   * layout whatever this says.
   */
  simulate?: boolean;
  /**
   * Every failure, as it was thrown: fossil's own errors arrive whole, with their `code`, and the
   * graph's are `GraphError`s. Required: unhandled, a browser with no WebGL context shows an empty box.
   */
  onFailure: (error: unknown) => void;
  onSelect?: (selection: Selection | null) => void;
  onFocus?: (vertex: VertexId | null) => void;
}

/**
 * Where the graph is in its life. `none` is no corpus; `loading` is the graph, a binding or a filter
 * not yet read or not yet drawn; `idle` is all of it drawn; `failed` is a corpus that would not read,
 * or a canvas with no GPU device to draw with — none came up, or the one it had was lost.
 *
 * **It is the data's life, not the layout's.** A layout running over a drawn graph is `idle` here and
 * `running` in `motion`: two axes, because each can move without the other — a filter loads under a
 * paused layout, and a layout runs over a graph with nothing left to read. A host that shows one word
 * reads both, and the `GraphStatus` part is that word, so a host draws the part, not the two axes.
 *
 * Named for its axis rather than `GraphStatus` because the part holds that name: a consumer writes
 * the part in every footer, and this union only where it reads `status` itself.
 */
export type DataStatus = "none" | "loading" | "idle" | "failed";

/** What the loaded graph holds, under the page's filter. */
export interface Drawn {
  /** Vertices in full colour: every one with a position that survives the filter. */
  readonly vertices: number;
  /** Links drawn: every loaded relation whose two ends are drawn. */
  readonly edges: number;
  /** What each category rank is: the seed first, then any other value seen, in rank order. */
  readonly domain: readonly unknown[];
  /** Per rank, the vertices drawn. */
  readonly tally: readonly number[];
}

/** What a host and the parts read, through `useGraphState`. */
export interface GraphState {
  readonly status: DataStatus;
  /** Every vertex of the corpus — it does not shrink with a filter. */
  readonly total: number | undefined;
  /** Vertices of the corpus the page's filter keeps, or `null` when nothing is filtered. */
  readonly matching: number | null;
  /** What is loaded, or `null` before the graph has loaded. */
  readonly drawn: Drawn | null;
  /** The categorical domain before anything is loaded: the drawn tables, or the host's names. */
  readonly domain: readonly unknown[];
  readonly selection: Selection | null;
  readonly focus: VertexId | null;
  readonly hovered: VertexId | null;
  readonly tool: Tool;
  readonly motion: Motion;
  /** How far through settling a live layout is, `0`–`1`. */
  readonly progress: number;
  readonly options: GraphOptions;
  /** The corpus's tables, once read. */
  readonly structure: Structure | null;
}

/** Where the camera looks: the point of the layout's square at the canvas's centre, and cosmos.gl's zoom. */
export interface View {
  readonly center: readonly [number, number];
  readonly zoom: number;
}

/**
 * **Where a canvas left the points and the camera**, for the current geometry — cosmos.gl's
 * `getPointPositions` read when the canvas detached, in the layout's square, and handed back to
 * `setPointPositions` when the next one attaches. The model is the store's and a canvas is a view of
 * it, so a canvas can go — and free its GPU — without the layout going with it. A new geometry drops
 * it: positions are kept for the vertices they were read for.
 */
export interface Arrangement {
  readonly positions: Float32Array;
  /** `null` when the canvas had no size to read a centre from. */
  readonly view: View | null;
}

/** The state, plus what only the renderer and the parts read. */
export interface GraphSnapshot extends GraphState {
  readonly binding: Binding;
  readonly geometry: Geometry | null;
  readonly encoding: Encoding | null;
  /** `1` where a vertex survives the page's filter; `null` when nothing is filtered. A vertex that does not is greyed out, never hidden. */
  readonly mask: Uint8Array | null;
  /** What the search was last used to go to, newest first — for the root's life, never stored. */
  readonly recent: readonly { readonly vertex: VertexId; readonly text: string }[];
  /** What the last canvas left, or `null` before one has drawn this geometry. */
  readonly arrangement: Arrangement | null;
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
  select(vertices: readonly VertexId[] | null, source?: SelectionSource, label?: string): void;
  focus(vertex: VertexId | null): void;
  hover(vertex: VertexId | null): void;
  /** A vertex the search went to, at the head of `recent`. */
  remember(vertex: VertexId, text: string): void;
  setTool(tool: Tool): void;
  report(motion: Motion): void;
  reportProgress(value: number): void;
  /** A canvas is detaching: keep where it left the current geometry's points and camera. */
  keep(arrangement: Arrangement): void;
  /** The canvas has a renderer again. */
  renderable(): void;
  /** The canvas cannot draw: the graph is `failed`, and `error` goes to `onFailure`. */
  unrenderable(error: unknown): void;
  /** The renderer uploaded this snapshot's geometry, encoding and mask. */
  reportDrawn(snapshot: GraphSnapshot): void;
}
