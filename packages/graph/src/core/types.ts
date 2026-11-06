/**
 * The vocabulary a graph view is described in — what to draw, how hard the forces pull, what is
 * selected and what the layout is doing.
 *
 * These lived beside a React context in the workspace showcase, which made them look like that
 * app's state. They are not: `VertexSelection` is the shape every panel hands the canvas, and the rest is
 * what a canvas is doing. The provider that holds them is an arrangement and stays where
 * arrangements live; the shapes themselves belong to the renderer.
 *
 * **`Look` and `Sim` are declared here and built in `render/`.** `GraphOptions` carries a patch of
 * each, and the core imports nothing from a layer above it; `lookFrom` and `simFrom` read the
 * declared values into them.
 */

/**
 * A vertex: its `dense_id`, which `@kanzo-tech/graph` numbers `0 … V − 1` from GraphAr's per-type
 * indices, in the graph document's order of the node types — so a vertex's id is also its index in
 * cosmos.gl's buffers.
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
export type VertexSelectionSource = "marquee" | "lasso" | "node";

/**
 * **The canvas's pick** — what the reader drew or clicked on it, published as one clause from the
 * graph, and the one the crossfilter exempts the graph from. A pick made beside the canvas is a
 * clause of its own and intersects with this one: every place that picks is one chip, and they add
 * up rather than replace each other.
 */
export interface VertexSelection {
  vertices: VertexId[];
  source: VertexSelectionSource;
  /** What the corner calls it. */
  label: string;
  /**
   * Whether the clause leaves `vertices` out rather than keeping them: what Alt publishes when the
   * canvas has no clause of its own to take from (`/docs/design/crossfilter`).
   */
  excludes: boolean;
}

/** What the canvas can be told to do. Registered by the canvas, called by the panels. */
export interface GraphCommands {
  zoomBy(factor: number): void;
  pause(): void;
  resume(): void;
  restart(): void;
  /** Select one vertex with its neighbours and frame them, taking the camera from any fit. */
  reveal(vertex: VertexId): void;
  /**
   * Frame what is in full colour: the canvas's pick within what the page's filter keeps, what the
   * filter keeps when the canvas picks nothing, or — when nothing is greyed out — the whole graph,
   * kept framed through a resize until the reader takes the camera.
   */
  frame(): void;
  clear(): void;
}

/** How much text the canvas carries, least to most — Cosmograph's label model as one scale. */
export type LabelLevel = "none" | "hovered" | "top" | "visible" | "all";

/**
 * The geometry a canvas draws — and nothing else.
 *
 * **No `id`, no `label`, no `blurb`.** Those three were a picker's metadata, and the picker was a
 * list of three names that turned out to be two pictures. What a person chooses is declared in
 * `section.ts` as axes and resolved by `lookFrom`; what a renderer consumes is this.
 */
export interface Look {
  /** Radius at the lowest degree in the graph, and at the highest. */
  size: [number, number];
  link: {
    /**
     * Whether the edge layer is drawn at all.
     *
     * It was `Display.links`, a second vocabulary for the picture that sat beside this one with its
     * own default and its own switch. A form that draws no links is a form.
     */
    render: boolean;
    opacity: number;
    width: number;
    /**
     * How far a link bows off the straight line, as a fraction of its length. `0` is straight.
     *
     * Keep it small. Every link curves the same way, so at cosmos.gl's default of `0.5` a few
     * hundred of them read as one pinwheel and the picture looks like it is spinning — motion
     * where there is structure. A hint is enough to tell two parallel edges apart.
     */
    curve: number;
    /**
     * Whether links **add** where they overlap, instead of compositing over one another.
     *
     * cosmos.gl's default is on, which is a choice nobody here made and which the archive made
     * visible: 4,280 grey links at 0.45 summed to a white spray that swallowed 1,543 points of
     * 2–9 px. Every point was uploaded, none was legible, and the picture read as *the nodes are
     * not rendering*.
     *
     * On, it is a real register rather than a bug — additive light is what makes a dense graph read
     * as flow — so it belongs to the form that wants it and not to the renderer's defaults.
     */
    blend: boolean;
    /**
     * Screen lengths between which a link fades out — depth, for free.
     *
     * Keep the far end generous. cosmos.gl measures this in *screen* pixels, so a range that
     * looks reasonable while zoomed in erases the whole edge layer when you zoom out, which
     * reads as "Show links stopped working".
     */
    fade: [number, number];
  };
  /** Which points carry their title — `labels` in `section.ts` says what each level draws. */
  labels: LabelLevel;
  /** A darkened rim. Mood rather than a reading aid, which is why it is form and not display. */
  vignette: boolean;
  /**
   * The dot grid behind the graph, which pans and subdivides with the camera.
   *
   * Beside `vignette` because it is the same kind of thing — the backdrop a form sits on — and it
   * arrived from the same place the rim did not: a `Display` interface that spelled the backdrop,
   * the edge layer and two multipliers as a second set of appearance controls.
   */
  grid: boolean;
  // **There is no `pointScale` and no `linkOpacity`**, and they are the two fields `Display` had that
  // this does not. Each was a reader's multiplier over a number this builder already computes from
  // the axis that owns it — `size` from `marks`, `link.opacity` from `marks` — so the panel offered
  // two ways to say one thing and the second could always overrule the measurement. The measured
  // pair (0.28 legible, 0.42 dense) is the whole argument of `marks`; a slider on top of it is the
  // post-process `graph-model.ts` forbids one layer down, wearing a preference's clothes.
  //
  // What is lost with them is the fit-to-graph case, and it was never a preference: a computed fit
  // belongs to the tenant's starting point — which is a policy, and which is now expressible.

  // There is no `filter`, and its absence is a rule rather than an omission. Nebula carried
  // `saturate(1.1)` on the canvas element — the one thing left in a Look that touched hue, and a
  // chroma multiplier is colour wearing geometry's clothes. Measured over Kanzo's eight slots
  // (2026-08-13, `saturate(1.1)` through the same filter engine the browser applies): it moved
  // every slot, by ΔE 0.85 to **8.05**, which is the size of the separation `deriveScheme`
  // *guarantees* between two different categories. It did not break that separation here —
  // the closest pair went from ΔE 32.36 to 30.38, with room to spare — so the reason it is gone
  // is not a failure it caused, it is that a look must not be able to cause one. The whole claim
  // of the colour layer is that what ships is what was derived and measured; a post-process on
  // the canvas voids it silently, and `graph-model.ts` already forbids the same move one layer
  // down ("nudging one on the way to the GPU voids all three").
}

/**
 * A look in the pieces a caller wants different — everything else is this package's answer.
 *
 * Two levels, because a `Look` has exactly two: the fields, and `link`. Deep-merging arbitrarily
 * would be a guess about a shape that is right here in this file, and `size` and `fade` are tuples
 * that must be replaced whole rather than merged element-wise.
 */
export interface LookPatch extends Partial<Omit<Look, "link">> {
  link?: Partial<Look["link"]>;
}

/** Force coefficients, handed straight to the GPU simulation. */
export interface Sim {
  gravity: number;
  repulsion: number;
  linkSpring: number;
  linkDistance: number;
  friction: number;
  /** Pull toward the centre of the vertex's cluster, when a column is bound to `cluster`. Zero lets the links decide alone. */
  cluster: number;
}
