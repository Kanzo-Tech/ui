/**
 * A GPU graph view, in the pieces a host actually composes.
 *
 * **`GraphCanvas` owns the three that never differ; the arrangement stays at the call site.** This
 * barrel said for a long time that there was no canvas component, on the argument that a graph
 * canvas is a toolbar, a legend, an inspector and a hover card — all of them per-product. That half
 * is still true and they are still yours. What the argument missed is that underneath them sit
 * three things that were identical everywhere and re-wired by hand each time: the renderer's
 * lifetime, the query loop that follows the camera, and the buffers a look implies.
 * `/docs/design/graph` has the measurement.
 *
 * **Why a package and not `@kanzo-tech/ui`.** The first admission rule is *domain-free —
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
//
// **Only the two a host asks something with.** `buffers`, `appearance`, `forces` and `isColour` were
// the conversion path published as four names, and a census of every import of this package —
// kanzo-ui, its showcases and examples, and fossil — found **zero** call sites for any of them.
// They are the canvas' own steps: `useGraphLook` calls the first two, `useRenderer` the third and
// `useGraph` the fourth, all inside this package. They were exported for a host writing its own
// buffers, and the one host that does write its own draws cosmos.gl directly and imports none of
// them. `Buffers` went with `buffers`: it is that function's return type and had no second producer.
//
// `scaleOf` and `neighboursOf` stay because they answer a question from *outside* the render path —
// a legend and a hover card ask the first what colour a category is, and the second is what a click
// handler wants. They tell a host something; the four above did something on its behalf.
export { scaleOf, neighboursOf, type Channels } from "./graph-model";

// The look: geometry only. Colour comes from the page's categorical scale, never from a look —
// a scale a graph invents is a scale that disagrees with the legend explaining it.
//
// **The shape scale is internal.** `SHAPE`, `SHAPE_ORDER` and `SHAPE_OTHER` were three exports of
// one decision — which glyph an ordinal wears — and no importer of this package has ever named any
// of them. The census is the argument: the numbers in `SHAPE` are cosmos.gl's own enum indices, and
// the jump from `3` to `7` is what gives that away. A host given them is being handed the
// renderer's internal numbering under our name, which is a thing we then owe compatibility on.
//
// **`DEFAULT_LOOK` is gone and the reason is what replaced it.** It was `lookFrom()` — a second
// public name for a value this package already hands out on request — and it existed because `look`
// took a whole `Look`, so a host changing one field wrote `{ ...DEFAULT_LOOK, vignette: true }`. A
// spread of a default is a **copy** of it: the host takes ownership of every number in it and stops
// tracking any of them the moment one moves here. `look` takes a `LookPatch` now and the merge
// happens on our side, so `{ vignette: true }` says the one thing the host decided.
//
// `lookFrom` stays and is not the same kind of thing at all: it parses a form's string answers —
// what `@kanzo-tech/graph/section` declares and a preferences panel writes — into a typed value.
// That is work, and there is nowhere else it can be done.
export {
  // The other end of `@kanzo-tech/graph/section`: the axes a person chose, as a form. The
  // manifest declares them, a host registers it, the panel draws them, and this reads the answer.
  // There is no table of named looks any more — see `/docs/design/graph`.
  lookFrom,
  type Look,
  type LookPatch,
  type Shape,
} from "./graph-looks";

// The glyph itself, for a legend key or a hover card that has to show what the canvas draws.
//
// `SHAPE_PATH` was here and this is what replaced it: the table handed a host path data plus three
// facts it had to keep in step with by reading a comment — a twelve-unit box, a `fill` rather than a
// `stroke`, and which enum index keys each glyph. A component carries all three. What is left at the
// call site is what the host actually decides, which is how big and what colour.
export { ShapeGlyph, type ShapeGlyphProps } from "./shape-glyph";

/**
 * The graph, in Ark's four pieces.
 *
 * `useGraph(props)` **creates** the api and `useGraphContext()` **reads** it, which is Ark's
 * convention and was inverted here: the reader was `useGraphCanvas` and there was no creator.
 * `GraphCanvas` is the shortcut that does both, and `GraphRootProvider` is what a host reaches for
 * when it has to call a hook *beside* the canvas — `useGraphOverlays` takes the api and the `events`
 * block reads `getGraph`/`getResident` off it, both from above the element where no context is
 * readable.
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

// `useRenderer`, `useQueryLoop` and `useGraphLook` are **not here**, and the argument that
// used to keep them here died this week.
//
// They shipped beside the canvas as an escape hatch, justified in one sentence: *the relationship is
// `ChartRoot` to `useChart`, not v2 to v1.* That analogy is gone — there is no `useChart` factory
// and `/docs/design/admission` says why, so charts ship exactly one way and the
// reference the graph was copying no longer reads that way. Measured after the workspace migrated:
// the three have **zero call sites** outside this package, comments mentioning them aside.
//
// One way to have a graph: `useGraph`, or `GraphCanvas` for the common case. The two hooks below
// are not a second way — they are chrome you draw *on top of* one, and they stay out of the canvas
// for the reason they always did: both need a policy only a product can write.
//
// **`REHEAT` and `GRID` are not here either, and both were tuning this package applies itself.**
// `REHEAT = 0.35` is the energy `useRenderer` puts back when the forces change, and the only way to
// spend it from outside is to reach past this package into the cosmos.gl instance and call `start`
// on it — at which point the number is that caller's decision, not a constant it should be borrowing
// from us. `GRID = 22` is the dot spacing the overlay painter keeps the on-screen grid inside, and
// the painter now seeds the element's own `background-size` from it: the two call sites that
// imported it were both writing the *initial* value of a style this hook overwrites on the first
// frame anyway.
//
// `useGraphOverlays(api)` — the api, not two getters copied out of it. It took a
// `GraphOverlayOptions` of `{ getGraph, getResident }`, which every host assembled by hand from the
// object `useGraph` had just handed it; there is no useful call where the two come from different
// graphs. That options type is gone with the shape it named.
//
// `GraphOverlays` stays, because a host composing the two has to name the *returned* object: the
// dependency is genuinely mutual — this takes the api, and a look change owes the overlays a repaint
// that no tick will produce — so the second direction goes through one ref, and a ref needs a type.
export { useGraphOverlays, type GraphOverlays } from "./use-graph-overlays";
export { useGraphSelection, cursorChip } from "./use-graph-selection";

/**
 * Identity, and the map from it to the buffer index cosmos.gl draws at.
 *
 * The renderer addresses points by position in the arrays it was handed, and a resident set that
 * comes and goes reuses every position. So a vertex is the pair `(type_idx, dense_id)`, and
 * everything that outlives one answer is held as one and re-resolved through the `Resident` that
 * `useQueryLoop` rebuilds per answer. A host never builds its own: two maps of the same thing is
 * how one of them ends up describing buffers that are no longer on screen.
 */
export {
  residentOf,
  vertexId,
  typeOf,
  denseOf,
  type Resident,
  type VertexId,
} from "./resident";

// Where the graph meets the crossfilter — and it is NOT here.
//
// `onceQuery` was on this barrel, and it imported the Mosaic stack — which arrived through
// `@kanzo-tech/ui/analytics` back when that was where a coordinator came from. So
// `import { GraphCanvas } from "@kanzo-tech/graph"` threw ERR_MODULE_NOT_FOUND for every host that
// had not installed an optional peer, while four places in this package promised the opposite.
// `scripts/smoke-install.mjs` holds the door shut now — and the name itself is gone from the
// repository: a `DuckSource` is a client of the page's coordinator, so there is no second query
// path left for a throwaway client to be.
//
// The Mosaic half now comes from `@kanzo-tech/mosaic`, and the difference is not cosmetic. Reaching
// it through the charts barrel meant `./duckdb` also pulled `@uwdata/vgplot`, which nothing here
// uses, so a host that installed the two peers this package documented still could not open the
// subpath — and vgplot had to be declared a peer to hide it. Nothing on this path names @uwdata at
// all now, and `scripts/smoke-install.mjs` asserts that rather than trusting this paragraph.
//
// A client is not re-exported here under any name. The one on `@kanzo-tech/graph/duckdb` is the
// source's own mouth and is not a thing to hand around; the generic shape — a view whose positions
// are outside the database publishing an enumerated set of ids — is `IdSetClient` in
// `@kanzo-tech/mosaic`, and none of it is cosmos.gl-specific. A `CosmosClient` alias here would
// only re-teach a name that was already retired.

/**
 * The bounded render path — a graph you never hold all of.
 *
 * A contract, not a format: anything that can answer "what is in this rectangle, at this zoom, in
 * at most this many marks" is a source. A tile fetched by a computed address is one; a relation
 * with `x`/`y` and a spatial predicate is another. This package renders and does not learn a storage layout,
 * which is what removed the ceiling rather than raising it.
 *
 * `useQueryLoop` is the loop that asks — it observes the camera, debounces, cancels what the
 * camera has already superseded, and pushes each answer into the renderer. **The source itself is
 * not here and there is one of it**: `openCorpus`, on `@kanzo-tech/graph/duckdb`, because a corpus
 * is read through a database and a database is an optional peer. What is left on this barrel is the
 * rendering surface — the hooks, the look, identity and the buffers a slice implies — and it draws
 * nothing on its own.
 */
//
// **Cancellation is the platform's, not ours.** `SUPERSEDED` and `isSuperseded` were here — an
// exported `Symbol` a source threw to say *you moved on*, and the predicate a caller tested it
// with. `SliceRequest.signal` already carried an `AbortSignal`, so the package published two
// cancellation contracts and a source had to import ours to be cancellable at all. A source cancels
// by rejecting with the signal's reason now, which is an `AbortError` — the same rejection `fetch`
// produces, from a source that only passed the signal along. `SliceRequest` carries the argument.
//
// **`BOUNDED_DEFAULTS` is gone, and the fix was not to delete it.** It was read from the *other* end
// of the contract: a source honoured `limit` and `minLinkPixels` when a request omitted them, so it
// had to import our table to find out what it was being asked. Two sources did, one of them in
// another repository, each finishing the same request in its own words.
//
// That is the defect, and it is not that the default was public — **a request that arrives
// unresolved is an incomplete request.** `useQueryLoop` fills both in before the question leaves, so
// they are required fields of `SliceRequest` now. A source reads `request.limit` and
// `request.minLinkPixels` and is done; it never needs to know what this package would have chosen,
// and there is nothing left to export. The host-facing side is unchanged — `limit` is still optional
// on `UseGraphProps`, and `minLinkPixels` was never a host's business.
export {
  shouldSlice,
  type BoundedSource,
  type Slice,
  type SliceRequest,
  type Viewport,
} from "./bounded";
// The source is on `@kanzo-tech/graph/duckdb`, not here, and there is exactly one of it:
// `openCorpus` takes where a corpus is and gives back both halves — a source for the canvas and
// registered views for the charts, the crossfilter and the verbs. Mosaic and fossil's reader are
// optional peers and that is the half that needs them, so **this barrel ships no source at all**
// and a host that installs neither gets the rendering surface and no picture.
//
// `memorySource` was here and the argument for it was *every consumer needs a source, including the
// ones bounding buys nothing for*. That is still true and it is no longer ours to answer: a host
// holding three typed arrays was being taught an API no product takes, and keeping the easy door
// open cost a second implementation of sampling, anchoring and the link-length discard, in
// JavaScript, that nothing but its own tests ever ran.

// Cluster seeding is **not here**. `clusterRing` is what actually separates communities, as opposed
// to what looks like it should — and it is what `useRenderer` calls the moment `clusters` is passed,
// which is the only way anybody has ever reached it. Nothing outside this package imported it: a
// host that wants seeded communities passes `clusters`, and one that does not gets no ring. Exported
// it was a second way to do the thing the prop already does, against a `spaceSize` the host would
// have had to read off the renderer itself.

// What a graph of a given size wants, for the host that runs a live layout. Absorbed from
// `@fossil-lang/viewer` per ADR-0040 — see the file for why it is tuning rather than level of detail.
export { adaptive } from "./adaptive";

// Theme colours as GPU floats. Exported because a host writing its own buffers needs the same
// resolution path, and two implementations of "what colour is `var(--primary)` here" is how a
// canvas ends up disagreeing with the page around it.
export { resolveToken, toHex, type Rgba } from "./css-color";

export {
  type GraphCommands,
  type Motion,
  type Selection,
  type SelectionSource,
  type Tool,
} from "./types";

// The forces, and the one function that builds them from the axes a person chose — `lookFrom`'s
// sibling. `Display` is not here and has no successor: what survived of it is `link.render` and
// `grid` on the `Look`, and the two multipliers it carried were a second way to say what `marks`
// already says.
//
// `DEFAULT_SIM` left with `DEFAULT_LOOK` and for the same argument: it is `simFrom()`, and `sim`
// takes a `Partial<Sim>` now, so there is nothing left to spread it for.
export { simFrom, type Sim } from "./graph-sim";

// The two readers above, joined to the provider's resolved `sectionPrefs` for `GRAPH_SECTION` — the
// eight lines every host under a preferences panel was writing for itself.
export { useGraphPrefs } from "./use-graph-prefs";
