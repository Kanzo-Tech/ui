/**
 * A GPU graph view, in the pieces a host actually composes.
 *
 * **`GraphCanvas` owns the three that never differ; the arrangement stays at the call site.** This
 * barrel said for a long time that there was no canvas component, on the argument that a graph
 * canvas is a toolbar, a legend, an inspector and a hover card — all of them per-product. That half
 * is still true and they are still yours. What the argument missed is that underneath them sit
 * three things that were identical everywhere and re-wired by hand each time: the renderer's
 * lifetime, the query loop that follows the camera, and the buffers a look implies.
 * `decisions/a-canvas-component-owns-the-three-that-never-differ.md` has the measurement.
 *
 * **Why a package and not `@kanzo-tech/ui`.** DESIGN.md's first admission rule is *domain-free —
 * nothing about RDF / SHACL / fossil / graphs / auth*. Graphs are excluded by name, deliberately:
 * `ui` is the generic vocabulary shared by every product. A sibling package is also the only place
 * a required WebGL peer belongs.
 *
 * **The measurements that shape it** are in `BENCHMARKS.md`: a live simulation is comfortable to
 * about 50,000 points and finished by 200,000, and past that the honest design is positions
 * precomputed once and stored as a column — which is why a simulation is opt-in here and off by
 * default, and why the render path is bounded rather than fast.
 */

// A slice in, the arrays a renderer wants out. `load()` was here and is gone — see ADR-0001.
export {
  buffers,
  scaleOf,
  isColour,
  forces,
  appearance,
  neighboursOf,
  SPACE,
  type Buffers,
  type Channels,
} from "./graph-model";

// The look: geometry only. Colour comes from the page's categorical scale, never from a look —
// a scale a graph invents is a scale that disagrees with the legend explaining it.
export {
  LOOKS,
  LOOK_ORDER,
  SHAPE,
  SHAPE_ORDER,
  SHAPE_OTHER,
  SHAPE_PATH,
  type Look,
  type LookId,
  type ShapeId,
} from "./graph-looks";

/**
 * The graph, in Ark's four pieces.
 *
 * `useGraph(props)` **creates** the api and `useGraphContext()` **reads** it, which is Ark's
 * convention and was inverted here: the reader was `useGraphCanvas` and there was no creator.
 * `GraphCanvas` is the shortcut that does both, and `GraphRootProvider` is what a host reaches for
 * when it has to call a hook *beside* the canvas — `useGraphOverlays` and the `events` block want
 * `getGraph` and `getResident` from above the element, where no context is readable.
 *
 * That was not a symmetry we wanted for its own sake: it is what the workspace could not adopt
 * `GraphCanvas` without, and the `graphRef`/`residentRef` props that stood in for it are gone.
 */
export {
  GraphCanvas,
  GraphRootProvider,
  useGraphContext,
  type GraphCanvasProps,
  type GraphRootProviderProps,
} from "./graph-canvas";
export { useGraph, type GraphApi, type GraphEvents, type UseGraphProps } from "./use-graph";

// `useCosmosGraph`, `useBoundedGraph` and `useGraphLook` are **not here**, and the argument that
// used to keep them here died this week.
//
// They shipped beside the canvas as an escape hatch, justified in one sentence: *the relationship is
// `ChartRoot` to `useChart`, not v2 to v1.* That analogy is gone — there is no `useChart` factory
// and `decisions/a-chart-needs-no-factory.md` says why, so charts ship exactly one way and the
// reference the graph was copying no longer reads that way. Measured after the workspace migrated:
// the three have **zero call sites** outside this package, comments mentioning them aside.
//
// One way to have a graph: `useGraph`, or `GraphCanvas` for the common case. The two hooks below
// are not a second way — they are chrome you draw *on top of* one, and they stay out of the canvas
// for the reason they always did: both need a policy only a product can write.
export { REHEAT } from "./use-cosmos-graph";
// `GraphOverlays` is exported alongside its options because a host composing it with `useGraph` has
// to name the returned object: the two are mutually dependent — overlays need `getGraph`, and the
// graph's repaint owes the overlays a nudge — so one of them is held in a ref, and a ref needs a type.
export {
  useGraphOverlays,
  GRID,
  type GraphOverlayOptions,
  type GraphOverlays,
} from "./use-graph-overlays";
export { useGraphSelection, cursorChip } from "./use-graph-selection";

/**
 * Identity, and the map from it to the buffer index cosmos.gl draws at.
 *
 * The renderer addresses points by position in the arrays it was handed, and a resident set that
 * comes and goes reuses every position. So a vertex is the pair `(type_idx, dense_id)`, and
 * everything that outlives one answer is held as one and re-resolved through the `Resident` that
 * `useBoundedGraph` rebuilds per answer. A host never builds its own: two maps of the same thing is
 * how one of them ends up describing buffers that are no longer on screen.
 */
export {
  residentOf,
  vertexId,
  typeOf,
  denseOf,
  SUPERNODE,
  type Resident,
  type VertexId,
} from "./resident";

// Where the graph meets the crossfilter — and it is NOT here.
//
// `onceQuery` was on this barrel, and it imports `@kanzo-tech/ui/analytics`, which statically
// imports the whole Mosaic stack. So `import { memorySource } from "@kanzo-tech/graph"` threw
// ERR_MODULE_NOT_FOUND for every host that had not installed an optional peer, while four places in
// this package promised the opposite. It is on `@kanzo-tech/graph/duckdb` with `duckBoundedSource`,
// which is the only thing that ever called it. `scripts/smoke-install.mjs` holds the door shut now.
//
// The client itself is not re-exported either. It lives in `@kanzo-tech/ui/analytics` as
// `IdSetClient`, because it turned out to model a view whose positions are outside the database — a
// graph, a map and an imperative widget all publish that same enumerated set of ids, and none of it
// is cosmos.gl-specific. Import it from there; a `CosmosClient` alias here would only re-teach a
// name that was already retired.

/**
 * The bounded render path — a graph you never hold all of.
 *
 * A contract, not a format: anything that can answer "what is in this rectangle, at this zoom, in
 * at most this many marks" is a source. A tile fetched by a computed address is one; a relation
 * with `x`/`y` and a spatial predicate is another. This package renders and does not learn a storage layout,
 * which is what removed the ceiling rather than raising it.
 *
 * `useBoundedGraph` is the loop that asks — it observes the camera, debounces, cancels what the
 * camera has already superseded, and pushes each answer into the renderer. `memorySource` is the
 * answer for a host that already holds its arrays: every consumer needs a source now, including the
 * ones bounding buys nothing for, so that one is written here once rather than at each call site
 * differently.
 */
export {
  BOUNDED_DEFAULTS,
  shouldSlice,
  type BoundedSource,
  type Slice,
  type SliceMode,
  type ExploringSource,
  type ExploreRequest,
  type SliceRequest,
  type Viewport,
} from "./bounded";
export { memorySource, type MemoryGraph } from "./memory-source";
// The DuckDB sources are on `@kanzo-tech/graph/duckdb`, not here: Mosaic is an optional peer and
// that is the half that needs it. A host drawing arrays it already holds should not import a
// database to find out it did not need one. Two live there and they are different jobs —
// `openCorpus` is the one that matters: it takes where a corpus is and gives back both halves —
// a source for the canvas and registered views for the charts, the crossfilter and the verbs.

// Cluster seeding — what actually separates communities, as opposed to what looks like it should.
export { clusterRing } from "./cluster-ring";

// What a graph of a given size wants, for the host that runs a live layout. Absorbed from
// `@fossil-lang/viewer` per ADR-0040 — see the file for why it is tuning rather than level of detail.
export { adaptive } from "./adaptive";

// Theme colours as GPU floats. Exported because a host writing its own buffers needs the same
// resolution path, and two implementations of "what colour is `var(--primary)` here" is how a
// canvas ends up disagreeing with the page around it.
export { resolveToken, toHex, type Rgba } from "./css-color";

export {
  DEFAULT_DISPLAY,
  DEFAULT_SIM,
  type Display,
  type GraphCommands,
  type Motion,
  type Selection,
  type SelectionSource,
  type Sim,
  type Tool,
} from "./types";
