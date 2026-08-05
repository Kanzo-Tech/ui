/**
 * A GPU graph view, in the pieces a host actually composes.
 *
 * **Not a component.** There is no `<GraphCanvas>` here, and that is the shape rather than an
 * omission: a graph canvas is a toolbar, a legend, an inspector and a hover card wired to one
 * renderer, and every one of those is an arrangement whose answers differ per product. What is
 * genuinely shared is underneath — reading a relation into typed arrays, turning a look and the
 * live theme into GPU buffers, owning the renderer's lifetime, and keeping a lasso inside a Mosaic
 * crossfilter. Those are here; the arrangement stays at the call site.
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
  forces,
  appearance,
  neighboursOf,
  SPACE,
  type Buffers,
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

// The renderer's lifetime, and the three hooks that keep it in step with React.
export { useCosmosGraph, REHEAT, type CosmosGraphOptions } from "./use-cosmos-graph";
export { useGraphLook } from "./use-graph-look";
export { useGraphOverlays, GRID, type GraphOverlayOptions } from "./use-graph-overlays";
export { useGraphSelection, cursorChip } from "./use-graph-selection";

/**
 * Identity, and the map from it to the buffer index cosmos.gl draws at.
 *
 * The renderer addresses points by position in the arrays it was handed, and a resident set that
 * comes and goes reuses every position. So a vertex is the pair `(type_idx, dense_id)` — ADR-0042 —
 * and everything that outlives one answer is held as one and re-resolved through the `Resident` that
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

// Where the graph meets the crossfilter. Optional: a host drawing arrays it already has needs
// neither this nor `load`, which is why the Mosaic peers are optional.
// The client itself is not re-exported. It lives in `@kanzo-tech/ui/analytics` as `IdSetClient`,
// because it turned out to model a view whose positions are outside the database — a graph, a map
// and an imperative widget all publish that same enumerated set of ids, and none of it is
// cosmos.gl-specific. Import it from there; a `CosmosClient` alias here would only re-teach a name
// that was already retired.
export { onceQuery } from "./once-query";

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
  type SliceQuery,
  type SliceRequest,
  type Viewport,
} from "./bounded";
export {
  useBoundedGraph,
  type BoundedGraphOptions,
  type BoundedGraphState,
} from "./use-bounded-graph";
export { memorySource, type MemoryGraph } from "./memory-source";
// The DuckDB source is on `@kanzo-tech/graph/duckdb`, not here: Mosaic is an optional peer and that
// is the half that needs it. A host drawing arrays it already holds should not import a database to
// find out it did not need one.

// Cluster seeding — what actually separates communities, as opposed to what looks like it should.
export { clusterRing } from "./cluster-ring";

// What a graph of a given size wants, for the host that runs a live layout. Absorbed from
// `@fossil-lang/viewer` per ADR-0040 — see the file for why it is tuning rather than level of detail.
export { adaptive } from "./adaptive";

// Theme colours as GPU floats. Exported because a host writing its own buffers needs the same
// resolution path, and two implementations of "what colour is `var(--primary)` here" is how a
// canvas ends up disagreeing with the page around it.
export { resolveToken, toHex, withAlpha, type Rgba } from "./css-color";

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
