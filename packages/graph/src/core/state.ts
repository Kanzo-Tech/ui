import type { Selection as Crossfilter } from "@kanzo-tech/mosaic";
import type { LookPatch } from "../render/graph-looks";
import type { Sim } from "../render/graph-sim";
import type { Binding, Channels } from "./channels";
import type { Corpus } from "@fossil-lang/corpus";
import type { Encoding, Geometry } from "./load";
import type { Motion, Selection, SelectionSource, Tool, VertexId } from "./types";

export interface GraphOptions extends Channels {
  /**
   * The corpus the host opened with fossil's `open`, or the promise of it. A promise is what makes
   * *opening* a state the graph can report; `null` is no corpus at all.
   *
   * The promise must settle. The graph shows *opening* until it does and sets no deadline of its
   * own: the waits inside an open are fossil's to bound, and a rejection reaches `onFailure`.
   */
  corpus: Corpus | PromiseLike<Corpus> | null;
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
   * Runs the live layout while true, from the points' current positions. Off by default: the corpus's
   * positions are drawn as they are. `GraphToolbar` starts and stops the layout whatever this says.
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
 * Where the graph is in its life. `none` is no corpus; `opening` is a corpus promised and not yet
 * open; `loading` is the graph, a binding or a filter not yet read or not yet drawn; `idle` is all of
 * it drawn; `failed` is a corpus that would not open or read, or a canvas with no GPU device to draw
 * with — none came up, or the one it had was lost.
 */
export type GraphStatus = "none" | "opening" | "loading" | "idle" | "failed";

/** What the loaded graph holds, under the page's filter. */
export interface Drawn {
  /** Vertices drawn: every one with a position that survives the filter. */
  readonly vertices: number;
  /** What each category rank is: the seed first, then any other value seen, in rank order. */
  readonly domain: readonly unknown[];
  /** Per rank, the vertices drawn. */
  readonly tally: readonly number[];
}

/** What a host and the parts read, through `useGraphState`. */
export interface GraphState {
  readonly status: GraphStatus;
  /** Vertices of the drawn types, from the manifest — it does not shrink with a filter. */
  readonly total: number | undefined;
  /** What is loaded, or `null` before the graph has loaded. */
  readonly drawn: Drawn | null;
  /** The categorical domain before anything is loaded: the drawn tables, or the host's names. */
  readonly domain: readonly unknown[];
  readonly selection: Selection | null;
  readonly focus: VertexId | null;
  readonly hovered: VertexId | null;
  readonly pinned: readonly VertexId[];
  readonly tool: Tool;
  readonly motion: Motion;
  /** How far through settling a live layout is, `0`–`1`. */
  readonly progress: number;
  /** The options as given, with the corpus once it is open. */
  readonly options: GraphOptions;
  readonly corpus: Corpus | null;
}

/** The state, plus what only the renderer and the parts read. */
export interface GraphSnapshot extends GraphState {
  readonly binding: Binding;
  readonly geometry: Geometry | null;
  readonly encoding: Encoding | null;
  /** `1` where a vertex survives the page's filter; `null` when nothing is filtered. */
  readonly mask: Uint8Array | null;
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
  pin(vertices: readonly VertexId[]): void;
  setTool(tool: Tool): void;
  report(motion: Motion): void;
  reportProgress(value: number): void;
  /** The canvas has a renderer again. */
  renderable(): void;
  /** The canvas cannot draw: the graph is `failed`, and `error` goes to `onFailure`. */
  unrenderable(error: unknown): void;
  /** The renderer uploaded this snapshot's geometry, encoding and mask. */
  reportDrawn(snapshot: GraphSnapshot): void;
}
