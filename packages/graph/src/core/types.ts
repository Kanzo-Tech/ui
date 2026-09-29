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

import type { VertexId } from "./resident";

/**
 * The selection tools, and the gesture that reaches them without a mode.
 *
 * `null` is the reading posture: drag pans, drag on a node pins it. Picking a tool swaps the drag
 * for a selection gesture — and holding Shift borrows the marquee for one drag without picking
 * anything, which is how most selections actually get made.
 */
export type Tool = "rect" | "lasso" | null;

/** `settled` converged on its own; `paused` is waiting for you. */
export type Motion = "running" | "settled" | "paused";

/**
 * Where a selection came from. Open-ended on purpose: a host with its own panels adds its own
 * sources, and the canvas only ever uses this to label the chip in the corner.
 */
export type SelectionSource = "marquee" | "lasso" | "node" | "order" | "ask";

/**
 * The selection — one value, published once.
 *
 * The rule this encodes: a panel does not touch the crossfilter. It hands a selection to the
 * canvas, the canvas publishes it as a single clause, and the corner shows it. Before that there
 * were four ways to say "look at these nodes" and therefore four half-answers to "what is selected
 * right now". Replacing rather than intersecting is the deliberate half — one live selection is
 * legible, and a reader can see the whole of it in one place.
 *
 * A *search* is not a selection and keeps its own clause: filtering narrows the corpus, selecting
 * points at part of it.
 */
export interface Selection {
  /**
   * Identities, never buffer indices.
   *
   * A selection is the one thing on this canvas guaranteed to outlive the answer that made it: a
   * reader selects, pans, and expects to come back to it. An index would have been reused by then,
   * and by a different vertex.
   */
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
  /** Let go of every pinned node, so the simulation gets the whole layout back. */
  unpin(): void;
  /** Centre and select one vertex. */
  reveal(vertex: VertexId): void;
  /** Frame whatever the canvas currently has selected. */
  frameSelection(): void;
  clear(): void;
}
