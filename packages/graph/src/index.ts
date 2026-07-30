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
 * precomputed once and stored as a column — which is why `load()` takes `xField` / `yField` and
 * why nothing here insists on running a simulation.
 */

// The data layer: a relation in, the arrays a renderer wants out.
export {
  load,
  buffers,
  scaleOf,
  forces,
  appearance,
  neighboursOf,
  SPACE,
  type GraphSpec,
  type Loaded,
  type NodeRow,
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
export { useGraphOverlays, GRID } from "./use-graph-overlays";
export { useGraphSelection, cursorChip } from "./use-graph-selection";

// Where the graph meets the crossfilter. Optional: a host drawing arrays it already has needs
// neither this nor `load`, which is why the Mosaic peers are optional.
// The client itself is not re-exported. It lives in `@kanzo-tech/ui/analytics` as `IdSetClient`,
// because it turned out to model a view whose positions are outside the database — a graph, a map
// and an imperative widget all publish that same enumerated set of ids, and none of it is
// cosmos.gl-specific. Import it from there; a `CosmosClient` alias here would only re-teach a name
// that was already retired.
export { onceQuery } from "./once-query";

// Cluster seeding — what actually separates communities, as opposed to what looks like it should.
export { clusterRing } from "./cluster-ring";

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
