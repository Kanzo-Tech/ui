/**
 * The vocabulary a graph view is described in — what to draw, how hard the forces pull, what is
 * selected and what the layout is doing.
 *
 * These lived beside a React context in the workspace showcase, which made them look like that
 * app's state. They are not: `Sim` is cosmos.gl's force coefficients under our names, `Display` is
 * the two uniforms plus three toggles, and `Selection` is the shape every panel hands the canvas.
 * The provider that holds them is an arrangement and stays where arrangements live; the shapes
 * themselves belong to the renderer, and every hook here takes one.
 */

/** Drawing options. None of these changes a number on screen, only how it is drawn. */
export interface Display {
  links: boolean;
  labels: boolean;
  /** The dot grid behind the graph. It pans and subdivides with the camera. */
  grid: boolean;
  /** Multiplies every radius the look computed. */
  pointScale: number;
  /** Multiplies the look's link opacity. */
  linkOpacity: number;
}

/** Force coefficients, handed straight to the GPU simulation. */
export interface Sim {
  gravity: number;
  repulsion: number;
  linkSpring: number;
  linkDistance: number;
  friction: number;
  /** Pull toward the node's group position on the cluster ring. Zero lets the links decide alone. */
  cluster: number;
}

export const DEFAULT_DISPLAY: Display = {
  links: true,
  labels: true,
  grid: true,
  pointScale: 1,
  linkOpacity: 1,
};

/**
 * Coefficients that settle a few-hundred-node graph into something readable.
 *
 * Chosen against a corpus of that size, and they are a starting point rather than a law: a graph
 * two orders of magnitude larger wants less repulsion and more friction, and the measurements in
 * `BENCHMARKS.md` say a live simulation is finished by around 200,000 points regardless.
 */
export const DEFAULT_SIM: Sim = {
  gravity: 0.14,
  repulsion: 1.1,
  linkSpring: 0.6,
  linkDistance: 18,
  friction: 0.86,
  cluster: 0.1,
};

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
  ids: number[];
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
  /** Centre and select a node by its database id. */
  reveal(id: number): void;
  /** Frame whatever the canvas currently has selected. */
  frameSelection(): void;
  clear(): void;
}
