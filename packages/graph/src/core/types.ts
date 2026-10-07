/**
 * The vocabulary a graph view is described in — what to draw, how hard the forces pull, what is
 * selected and what the layout is doing.
 *
 * These lived beside a React context in the workspace showcase, which made them look like that
 * app's state. They are not: `Selection` is the shape every panel hands the canvas, and the rest is
 * what a canvas is doing. The provider that holds them is an arrangement and stays where
 * arrangements live; the shapes themselves belong to the renderer.
 *
 * **`Display` and `Sim` have left this file**, and in opposite directions. `Display` was a second
 * vocabulary for the picture — two multipliers over numbers `lookFrom` already computes, plus three
 * toggles — so what survived of it is `link.render` and `grid` on the `Look`. `Sim` went to
 * `graph-sim.ts` with a builder of its own, because it is what `graph-looks.ts` is for forces: a
 * type, one function that reads the declared values, and a default that is the function called with
 * nothing.
 */

/**
 * A vertex: its `dense_id`, which fossil numbers `0 … V − 1` across every vertex table of the corpus.
 * The drawn types take the first ids, so a drawn vertex's id is also its index in cosmos.gl's buffers.
 */
export type VertexId = number;

/**
 * The selection tools, and the gesture that reaches them without a mode.
 *
 * `null` is the reading posture: drag pans, and drag on a node moves it. Picking a tool swaps the drag for a selection gesture — and holding Shift borrows the marquee
 * for one drag without picking anything, which is how most selections actually get made.
 */
export type Tool = "rect" | "lasso" | null;

/** `settled` converged on its own; `paused` is waiting for you. */
export type Motion = "running" | "settled" | "paused";

/**
 * Which of the canvas's own gestures made the selection. A pick from anywhere else — a search, a
 * rule, an answer — is not a selection of the canvas: it is a clause of its own on the crossfilter
 * (`usePick`), which greys out the rest of the graph.
 */
export type SelectionSource = "marquee" | "lasso" | "node";

/**
 * **The canvas's pick** — what the reader drew or clicked on it, published as one clause from the
 * graph, and the one the crossfilter exempts the graph from. A pick made beside the canvas is a
 * clause of its own and intersects with this one: every place that picks is one chip, and they add
 * up rather than replace each other.
 */
export interface Selection {
  vertices: VertexId[];
  source: SelectionSource;
  /** What the corner calls it. */
  label: string;
}

/** What the canvas can be told to do. Registered by the canvas, called by the panels. */
export interface GraphCommands {
  zoomBy(factor: number): void;
  fit(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  /** Select one vertex with its neighbours and frame them, taking the camera from any fit. */
  reveal(vertex: VertexId): void;
  /** Frame whatever the canvas currently has selected. */
  frameSelection(): void;
  clear(): void;
}
