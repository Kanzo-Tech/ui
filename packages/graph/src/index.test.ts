import { describe, expect, it } from "vitest";
import * as GRAPH from "./index";

/**
 * What `import { … } from "@kanzo-tech/graph"` is allowed to find, and what it must not.
 *
 * The same two halves as `packages/ui/src/index.test.ts` and for the same reasons — a positive set
 * that catches a module which fails to load or a name two modules both export, and tombstones that
 * carry the argument which removed a name. It exists here because the negative half had nothing
 * holding it: this package crossed the optional-peer door that CLAUDE.md names, and stayed across
 * it for as long as it did because no test in the repository asserted anything about this barrel.
 *
 * ## The door, and why it is asserted from two sides
 *
 * `onceQuery` was exported here. Its module imported `@kanzo-tech/ui/analytics`, which statically
 * imports `@uwdata/mosaic-core`, `@uwdata/mosaic-sql` and `@uwdata/vgplot` — so
 * `import { memorySource } from "@kanzo-tech/graph"` threw ERR_MODULE_NOT_FOUND for every host that
 * had not installed a database, while `src/index.ts`, `src/duck-source.ts`, the manifest and the
 * README each promised in their own words that it would not. The name no longer exists anywhere:
 * `slice-client.ts` replaced it with a client the coordinator owns. That barrel is no longer the
 * way in either: the Mosaic half comes from `@kanzo-tech/mosaic`, which is why `./duckdb` no longer
 * drags vgplot behind it. It is still asserted below,
 * because what the assertion is for is the *door* rather than the name — the next module to import
 * the Mosaic stack will not be called `onceQuery` either.
 *
 * The absence below is the cheap half and it is not the proof: Mosaic IS installed in this
 * workspace, so `./index` would import happily even with the re-export back. What proves it is
 * `pnpm smoke`, which packs the tarball, installs it with none of the optional peers and imports the
 * root barrel there. This file's job is to make the *intent* fail loudly at the moment somebody
 * writes the export, minutes before the tarball would.
 *
 * ## What this guard cannot prove
 *
 * - **Nothing about the built artefact, and nothing about the peers.** It imports `./index`, which
 *   is source, in a workspace where every optional peer is present. `pnpm smoke` is the only thing
 *   that sees the packed `dist/` in a tree without them.
 * - **Nothing about shape, and there is no behaviour left here to check.** `toBeTypeOf("function")`
 *   is satisfied by any function. There used to be two assertions below that *ran* something —
 *   `memorySource` answering a slice, and the same source sampling a window it could not fit — and
 *   they went with the source. This barrel ships no source now, so the only thing it can be asked is
 *   what is on it; what it *draws* is `@kanzo-tech/graph/duckdb`'s to answer, and
 *   `duck-source.test.ts` is where that is asked.
 * - **Nothing about types.** `export type` contributes no runtime binding, so `Slice`, `Look`,
 *   `VertexId` and the rest of the type surface are outside this file by construction.
 * - **It cannot tell a tombstone from a name nobody has written yet.** `toBeUndefined()` reads the
 *   same for both. The comment above each is the only thing carrying the reason.
 *
 * ## It is a pin now, and that bullet used to say the opposite
 *
 * This file described itself as *an enumeration, not a pin — no `Object.keys` comparison and no
 * snapshot: adding an export never fails this file*, and stated it as a property rather than a gap.
 * It is the reason the surface reached **sixty-three** names. Every one of them arrived the same
 * way: a module gained an `export`, the barrel forwarded it, and the only test that reads this
 * barrel went green because it had never been asked what was *not* on the list. A census then found
 * eight names that no importer anywhere — this repository, its showcases, its examples, or fossil —
 * had ever written.
 *
 * `VALUES` below closes that. It is compared with `toEqual`, so **adding** an export fails this file
 * until somebody writes the name into the list, next to the names that earned their place. That is
 * the whole mechanism and it is deliberately dumb: the cost of a new export is one line here, and
 * the line is the moment to ask whether a host was ever going to call it.
 *
 * It pins the **runtime** surface only. `export type` contributes no binding, so the type half is
 * still unpinned and still outside this file by construction — `tsc` is what holds that end.
 */
/**
 * Every value `import { … } from "@kanzo-tech/graph"` can find, written by hand.
 *
 * Sorted, because `Object.keys` on a module namespace is sorted and a diff between two sorted lists
 * is readable. Grouped in source order rather than alphabetically would read better and would make
 * the failure message a puzzle; the barrel is where the grouping and the argument live.
 */
const VALUES = [
  "GraphCanvas",
  "GraphRootProvider",
  "ShapeGlyph",
  "adaptive",
  "cursorChip",
  "denseOf",
  "lookFrom",
  "neighboursOf",
  "residentOf",
  "resolveToken",
  "scaleOf",
  "shouldSlice",
  "simFrom",
  "toHex",
  "typeOf",
  "useGraph",
  "useGraphContext",
  "useGraphOverlays",
  "useGraphSelection",
  "vertexId",
];

describe("@kanzo-tech/graph public surface", () => {
  /**
   * The half this file did not have, and the reason the other half was not enough.
   *
   * Everything below enumerates: it names what must be there and what must not, and a name in
   * neither list is invisible to it. Sixty-three exports accumulated inside that blind spot. This
   * one assertion is the whole fix — a name reaching the barrel without reaching `VALUES` fails
   * here, so the surface can only grow on purpose.
   */
  it("is exactly this list, and grows only by somebody writing a name into it", () => {
    expect(Object.keys(GRAPH).sort()).toEqual(VALUES);
  });

  it("exposes the render path, which is the package", () => {
    expect(GRAPH.scaleOf).toBeTypeOf("function");
    expect(GRAPH.neighboursOf).toBeTypeOf("function");
    expect(GRAPH.useGraphOverlays).toBeTypeOf("function");
    expect(GRAPH.useGraphSelection).toBeTypeOf("function");
    expect(GRAPH.adaptive).toBeTypeOf("function");
    expect(GRAPH.cursorChip).toBeTypeOf("function");
    expect(GRAPH.shouldSlice).toBeTypeOf("function");
    // Identity is the pair, and a host never builds its own map from it: two maps of the same
    // thing is how one ends up describing buffers that are no longer on screen.
    expect(GRAPH.vertexId).toBeTypeOf("function");
    expect(GRAPH.typeOf).toBeTypeOf("function");
    expect(GRAPH.denseOf).toBeTypeOf("function");
    expect(GRAPH.residentOf).toBeTypeOf("function");
    // The tables and constants a call site cannot reconstruct.
    // No table of named looks: what a person chooses is declared as axes in `section.ts` and
    // resolved here.
    expect(GRAPH.lookFrom).toBeTypeOf("function");
    expect(GRAPH.lookFrom().size.length).toBe(2);
    // Tombstone. `SPACE = 4096` was the renderer's coordinate box declared here and owned by
    // whatever wrote the positions; a corpus fossil wrote spans 157× it and nothing failed, because
    // `spaceSize` is a translation in every render path. The box is the source's `extent()` now, set
    // where `useQueryLoop` already awaits one — `coordinate-box.test.ts` is the guard.
    expect((GRAPH as Record<string, unknown>).SPACE).toBeUndefined();
    // The forces have a builder, exactly as the look does. There is no `DEFAULT_DISPLAY` and no
    // successor to it: a second vocabulary for the picture is what `lookFrom` replaced.
    expect(GRAPH.simFrom).toBeTypeOf("function");
    expect((GRAPH as Record<string, unknown>).DEFAULT_DISPLAY).toBeUndefined();
  });

  it("keeps the Mosaic/DuckDB half off the root barrel", () => {
    // The one-way door CLAUDE.md names, and the one this package had already crossed.
    //
    // `onceQuery` was a `MosaicClient` subclass — its module imported the Mosaic stack,
    // which statically imports the whole Mosaic stack, all of it optional. Re-exported here it made
    // `import { memorySource } from "@kanzo-tech/graph"` throw ERR_MODULE_NOT_FOUND for anyone
    // without a database, which is the exact failure `/editor`, `/table` and `/analytics` exist to
    // prevent in `@kanzo-tech/ui`. The name is gone entirely now, and `SliceRead` is what a source
    // queries through — a client the coordinator owns rather than one per query.
    //
    // Every one of these lives on `@kanzo-tech/graph/duckdb`. Deliberately not imported here —
    // importing the subpath from a test in this package would prove nothing (Mosaic is installed in
    // the workspace) and would make this file the thing that reaches it.
    const surface = GRAPH as Record<string, unknown>;
    expect(surface.onceQuery).toBeUndefined();
    // `duckBoundedSource` was on the subpath and is now nowhere: it is asserted here rather than
    // dropped, because the name is the obvious one to reach for the next time somebody wants a graph
    // over two relations they already have, and the answer is that a corpus declares those columns.
    expect(surface.duckBoundedSource).toBeUndefined();
    expect(surface.openCorpus).toBeUndefined();
    expect(surface.SliceRead).toBeUndefined();
    // The client is not here under any name either. It lives in `@kanzo-tech/mosaic` as
    // `IdSetClient`, because a graph, a map and an imperative widget all publish the same
    // enumerated set of ids and none of that is cosmos.gl-specific. `CosmosClient` was the name it
    // had here; re-teaching it would be re-teaching a retired one.
    expect(surface.CosmosClient).toBeUndefined();
    expect(surface.IdSetClient).toBeUndefined();
  });

  it("drops the exports that never earned a second call site", () => {
    const surface = GRAPH as Record<string, unknown>;
    // `withAlpha([r, g, b], a)` was a three-element destructure and a fourth value — an array
    // literal with a name. It had zero references anywhere in the repository: not another module in
    // this package, not a test, not a showcase, not a doc page.
    // Admission rule 2 decides that case, and there is no carve-out
    // to reach for: the reference is silent about graphs, so the house principle is all there is.
    // `resolveToken` and `toHex` stay — both are called by `graph-model.ts` and by the benchmark
    // showcase, and they are the shared answer to "what colour is `var(--primary)` here", which is
    // the question a host writing its own buffers has to answer the same way the canvas does.
    expect(surface.withAlpha).toBeUndefined();
    expect(GRAPH.resolveToken).toBeTypeOf("function");
    expect(GRAPH.toHex).toBeTypeOf("function");
  });

  /**
   * The census, and the eight names it found nobody had ever written.
   *
   * Every import of `@kanzo-tech/graph` in the tree was read — this repository, its showcases and
   * examples, and fossil, the one consumer outside it — and these eight appear in **no** import
   * list anywhere. Not "used once, in a place we could migrate": zero. They were on the barrel
   * because they were `export`ed from a module the barrel forwards whole, which is the mechanism
   * that took this surface to sixty-three names with nothing going red — see the header, and the
   * pin below that closes it.
   *
   * Each is still exported from its own module, because each has a caller *inside* this package.
   * That is the distinction the removal rests on: they are steps the canvas takes, not questions a
   * host asks. A step the canvas takes is not a promise we owe.
   */
  it("keeps the canvas' own steps off the barrel", () => {
    const surface = GRAPH as Record<string, unknown>;
    // The conversion path, in four names. `useGraphLook` calls `buffers` and `appearance`,
    // `useRenderer` calls `forces`, `useGraph` calls `isColour` — and a host that calls any of them
    // itself has stopped using the canvas, which is the only thing they exist to serve. The one host
    // that does write its own buffers draws cosmos.gl directly and imports none of these.
    expect(surface.buffers).toBeUndefined();
    expect(surface.appearance).toBeUndefined();
    expect(surface.forces).toBeUndefined();
    expect(surface.isColour).toBeUndefined();
    // The shape scale, in three. `SHAPE`'s values are cosmos.gl's own `setPointShapes` enum indices
    // and the jump from `3` (diamond) to `7` (cross) is what gives that away: exported, they made
    // the renderer's internal numbering a number we owe compatibility on. `SHAPE_ORDER` is the cycle
    // and `SHAPE_OTHER` the past-capacity glyph; both are decisions `buffers` makes, one layer under
    // anything a host names.
    expect(surface.SHAPE).toBeUndefined();
    expect(surface.SHAPE_ORDER).toBeUndefined();
    expect(surface.SHAPE_OTHER).toBeUndefined();
    // `clusterRing` is what `useRenderer` calls the moment `clusters` is passed, which is how every
    // caller has ever reached it. On the barrel it was a second way to do what the prop does, and it
    // takes the renderer's `spaceSize` — a number the host would have to read back off the graph to
    // call it correctly, and would get wrong the first time the corpus set a different box.
    expect(surface.clusterRing).toBeUndefined();
    // The prop is the way, and it still works.
    expect(GRAPH.useGraph).toBeTypeOf("function");
  });

  /**
   * `useGraphOverlays(api)` — the api, not two getters copied out of it.
   *
   * `GraphOverlayOptions` was `{ getGraph, getResident }`, and every host built it by hand from the
   * object `useGraph` had just returned. That is a re-statement rather than a decision: there is no
   * useful call where the graph and the resident map come from different graphs, and the shape's
   * only real effect was to make those two getters look like part of the *overlays'* contract rather
   * than the api's.
   *
   * It is a type, so nothing here can assert its absence — `tsc` is what holds that, and what stands
   * in for it below is the hook still being one function of one argument.
   *
   * **`getGraph` and `getResident` stayed on `GraphApi`**, which the same census decided: this was
   * the one shape that could have been the whole reason for them, and it was not. `useGraphSelection`
   * takes both — its `commit` is a policy only a product writes, so it cannot absorb the api the way
   * the overlays did — and fossil reads both off `useGraphContext()` to paint its own mask. Removing
   * them would have moved work into two consumers to save one line here.
   */
  it("hands the overlays the api rather than a shape assembled from it", () => {
    expect(GRAPH.useGraphOverlays).toBeTypeOf("function");
    expect(GRAPH.useGraphOverlays.length).toBe(1);
    // Still published, and still for the mutual half: a look change owes the overlays a repaint that
    // no tick produces, so `useGraph` takes a `schedule` and a host bridges the two with one ref.
    // A ref needs a type, which is what `GraphOverlays` is for.
    expect(GRAPH.useGraph).toBeTypeOf("function");
  });

  /**
   * A shape is a **name**, and five exports were holding one concept.
   *
   * `SHAPE = { circle: 0, square: 1, triangle: 2, diamond: 3, cross: 7 }` was the vocabulary, and
   * the jump from `3` to `7` is the tell: those are cosmos.gl's `setPointShapes` enum indices, with
   * `4` Pentagon, `5` Hexagon and `6` Star missing because this canvas does not draw them. `ShapeId`
   * was the union of those numbers, `SHAPE_ORDER` the four-slot cycle, `SHAPE_OTHER` the
   * past-capacity glyph, and `SHAPE_PATH` a table keyed by them. Every one of the five answered part
   * of one question — *which glyph* — and publishing them made a renderer's internal numbering a
   * number this package owes compatibility on. A host held `3` where it meant *diamond*.
   *
   * `type Shape = "circle" | … | "cross"` says the same thing, reads at the call site, and leaves
   * `SHAPE_INDEX` — the name→enum map — as `graph-looks.ts`' private business, called at exactly one
   * point: `buffers`, on the way to `setPointShapes`, where a number is genuinely what is wanted.
   *
   * `SHAPE_ORDER` and `SHAPE_OTHER` stayed *inside*: the cycle and the discard are decisions the
   * scale makes, one layer under anything a host names. `obligations.ts` still grades both — five
   * distinguishable glyphs against the channel's measured capacity, and the fallback not colliding
   * with a slot — and grades them on the names now.
   */
  it("names its glyphs instead of publishing cosmos.gl's enum", () => {
    const surface = GRAPH as Record<string, unknown>;
    expect(surface.SHAPE).toBeUndefined();
    expect(surface.SHAPE_PATH).toBeUndefined();
    // `ShapeId` is a type and leaves no binding; what stands in for its removal is `tsc` and the
    // one runtime consequence, which is that the scale answers with a string.
    expect(GRAPH.scaleOf({ symbol: "kind" }).shape(0)).toBe("circle");
    expect(GRAPH.scaleOf({ symbol: "kind" }).shape(4)).toBe("cross");
    // And the glyph a legend draws is a component now, taking that same name.
    expect(GRAPH.ShapeGlyph).toBeTypeOf("function");
  });

  /**
   * A request that arrives unresolved is an incomplete request.
   *
   * `BOUNDED_DEFAULTS` was the last constant on this barrel and the only one that survived the first
   * pass, on an argument that turned out to be the diagnosis rather than the defence: it is read
   * from the *other* end of the contract. A **source** honoured `limit` and `minLinkPixels` when a
   * request omitted them, and a source is written outside this package — `duck-source.ts` here, and
   * fossil's tile reader in another repository. So it looked like a value a source legitimately has
   * to be able to look up.
   *
   * It is not. If a source has to consult a table of ours to learn what it is being asked, the
   * question was not finished when it was sent. Two sources finished it independently, in their own
   * words, which is two chances to disagree about one number and no way to notice.
   *
   * `useQueryLoop` resolves both before the request leaves, so they are **required** fields of
   * `SliceRequest`: a source reads `request.limit` and `request.minLinkPixels` and is done. The
   * export disappears and the second reader stops needing it — the same deletion that would have
   * broken fossil now removes the reason fossil imported it.
   *
   * The host-facing side is unchanged: `limit` is still optional on `UseGraphProps`, and
   * `minLinkPixels` was never a host's business. What changed is what goes *out* to a source.
   */
  it("finishes the question before a source sees it", () => {
    const surface = GRAPH as Record<string, unknown>;
    expect(surface.BOUNDED_DEFAULTS).toBeUndefined();
    // Nor under a new name. The numbers are module scoped in `bounded.ts` and nothing outside needs
    // to look them up any more, which is the whole of why the export could go.
    expect(surface.DEFAULT_LIMIT).toBeUndefined();
    expect(surface.DEFAULT_MIN_LINK_PIXELS).toBeUndefined();
    // `shouldSlice` stays: it takes the limit as an argument rather than reading one, which is the
    // same shape this change gave the request — the caller says what it means, the callee answers.
    expect(GRAPH.shouldSlice(undefined, 20_000)).toBe(true);
    expect(GRAPH.shouldSlice(10, 20_000)).toBe(false);
  });

  /**
   * A default a host has to spread is a default it takes ownership of.
   *
   * `DEFAULT_LOOK` was `lookFrom()` and `DEFAULT_SIM` was `simFrom()` — two public names for values
   * this package already hands out when asked. They existed for one reason: `look` took a whole
   * `Look` and `sim` a whole `Sim`, so a host that wanted the vignette on had to write
   * `{ ...DEFAULT_LOOK, vignette: true }`. That spread is a **copy**. Every number in it becomes the
   * host's, frozen at the version it was compiled against, and the next time a measurement moves one
   * of them here the host keeps drawing the old picture with nothing failing anywhere.
   *
   * `look` takes a `LookPatch` and `sim` a `Partial<Sim>` now, so the merge happens on our side and
   * `{ vignette: true }` says exactly what the host decided. The defaults still exist — they are
   * what the merge merges against — they are simply not a thing anybody has to hold.
   *
   * `lookFrom` and `simFrom` stay, and the distinction is the whole point of the removal: they do
   * **work**. Each parses a form's string answers — the axes `@kanzo-tech/graph/section` declares
   * and a preferences panel writes — into a typed value, and there is nowhere else that can happen.
   * A constant is not work.
   *
   * `REHEAT` and `GRID` went with them as tuning this package applies itself: 0.35 is the energy
   * `useRenderer` puts back when the forces change, and 22 is the spacing the overlay painter keeps
   * the grid inside — which it now writes onto its own element rather than publishing so a call site
   * can write it first.
   */
  it("merges its own defaults instead of publishing them to be spread", () => {
    const surface = GRAPH as Record<string, unknown>;
    expect(surface.DEFAULT_LOOK).toBeUndefined();
    expect(surface.DEFAULT_SIM).toBeUndefined();
    expect(surface.REHEAT).toBeUndefined();
    expect(surface.GRID).toBeUndefined();
    // The builders stay, and the reason is that they answer a question rather than hold a value:
    // called with the axes a person chose, they are the only path from a form to a typed look.
    expect(GRAPH.lookFrom({ marks: "legible" }).size).toEqual([4, 13]);
    expect(GRAPH.simFrom({ gravity: "0.5" }).gravity).toBe(0.5);
    // And called with nothing they are the defaults, which is what made the two constants a second
    // name for a value rather than a value.
    expect(GRAPH.lookFrom()).toEqual(GRAPH.lookFrom({}));
    expect(GRAPH.simFrom()).toEqual(GRAPH.simFrom({}));
  });

  /**
   * Cancellation is the platform's word, and this package published a second one for it.
   *
   * `SUPERSEDED` was an exported `Symbol` a source threw to say *the camera moved on*, with
   * `isSuperseded` beside it as the test. The argument for it was sound as far as it went: *you
   * moved on* and *the database said no* are the two things a query loop must tell apart, and a
   * string comparison against a thrown value goes stale with nothing failing. What it missed is that
   * `SliceRequest` **already carried an `AbortSignal`**, so the package shipped two cancellation
   * contracts and left every source author to discover which one this loop actually honoured.
   *
   * The cost was not hypothetical. A source is anything that answers a bounded question, and the
   * obvious way to write one is over `fetch` with the signal passed straight through. That source
   * rejects with a `DOMException` named `AbortError` — the standard thing, produced without being
   * told to — and `isSuperseded` returned `false` for it, so a cancelled question was reported to
   * the host through `onFailure` as though the database had refused. Being cancellable *correctly*
   * required importing a symbol from us.
   *
   * What replaces it is one sentence a third source author never has to look up: **a source that
   * cancels rejects with the signal's reason.** `useQueryLoop` tests `error.name === "AbortError"`,
   * which is WHATWG's contract rather than a message, and holds across realms where `instanceof`
   * does not. `slice-client.test.ts` is the guard on the one producer that has no signal to rethrow.
   */
  it("cancels the way the platform does, with no sentinel of its own", () => {
    const surface = GRAPH as Record<string, unknown>;
    expect(surface.SUPERSEDED).toBeUndefined();
    expect(surface.isSuperseded).toBeUndefined();
    // Nor is there a replacement pair under a new spelling — that would be the same mistake with a
    // better name. `abortError` and `isAbort` exist in `bounded.ts` for this package's own two
    // producers and one consumer, and neither is reachable from here.
    expect(surface.abortError).toBeUndefined();
    expect(surface.isAbort).toBeUndefined();
    // The signal is on the request and always was, which is what made the sentinel redundant rather
    // than merely unfashionable. It is a type, so what stands in for it here is `duck-source.ts`'s
    // `throw signal.reason` and the paragraph on `SliceRequest.signal`.
    expect(GRAPH.shouldSlice).toBeTypeOf("function");
  });

  it("ships a canvas that owns the renderer, and neither load nor Loaded", () => {
    const surface = GRAPH as Record<string, unknown>;
    // This assertion was the reverse of itself, and the reversal is the record rather than a fix:
    // `/docs/design/graph`. What the old argument got
    // right is still true — a toolbar, a legend, an inspector and a hover card answer differently
    // per product, and none of them is in here. What it missed is the three underneath that were
    // identical everywhere and hand-wired at each call site.
    expect(GRAPH.GraphCanvas).toBeTypeOf("function");
    // Ark's four, and the two names that carry the convention: `useGraph` **creates**,
    // `useGraphContext` **reads**. `useGraphCanvas` was the reader wearing the creator's name, so
    // anyone arriving from Ark read it as the opposite of what it did. It is renamed, not aliased —
    // nothing is published and rule 1 forbids the shim.
    expect(GRAPH.useGraph).toBeTypeOf("function");
    expect(GRAPH.GraphRootProvider).toBeTypeOf("function");
    expect(GRAPH.useGraphContext).toBeTypeOf("function");
    expect(surface.useGraphCanvas).toBeUndefined();
    // Two hooks stay beside it and they are **not a second way to have a graph**: overlays and
    // selection are chrome drawn on top of one, and both need a policy only a product can write.
    expect(GRAPH.useGraphOverlays).toBeTypeOf("function");
    expect(GRAPH.useGraphSelection).toBeTypeOf("function");
    // The machine's own three are gone. They shipped as an escape hatch on one sentence — *the
    // relationship is `ChartRoot` to `useChart`* — and that analogy died with
    // the analytics layer: there is no `useChart` factory, so charts ship exactly
    // one way and the reference this copied no longer reads that way. Measured after the workspace
    // migrated to `useGraph`: zero call sites outside this package, comments aside.
    expect(surface.useRenderer).toBeUndefined();
    expect(surface.useQueryLoop).toBeUndefined();
    expect(surface.useGraphLook).toBeUndefined();
    // ADR-0001. `load()` read the whole relation into memory — every id, every row, an id→index map
    // — which made the working set N and the ceiling whatever N the machine could hold. A source
    // answers a bounded question instead, and `Loaded` went with it.
    expect(surface.load).toBeUndefined();
    expect(surface.Loaded).toBeUndefined();
  });

  /**
   * `memorySource` — the arrays-in-hand source, and what its going costs.
   *
   * It existed on one sentence and the sentence was true: ADR-0001 deleted `load()`, so **every**
   * consumer needs a source, including the ones bounding buys nothing for, and "wrap your arrays"
   * was one import rather than a hundred lines each call site wrote differently. It was also the
   * cheapest thing on this page — three typed arrays, one call, no database — and the reason it is
   * gone is that cheapness: it taught an API no product takes, and keeping the easy door open meant
   * a second implementation of sampling, anchoring and the link-length discard, in JavaScript,
   * running nowhere but its own tests.
   *
   * **What goes with it is a guarantee, and it is worth naming rather than mourning.**
   * `scripts/smoke-install.mjs` used to install the tarball with no optional peer and *draw* — the
   * only behavioural proof anywhere that the root barrel did not reach the Mosaic stack. There is
   * nothing on this barrel left to draw with, so what that check asserts now is that the barrel
   * **imports** under those conditions, which is the weaker half of the same door and the half that
   * actually broke once.
   *
   * **What would reverse it:** a host that genuinely holds arrays and cannot compile a corpus — a
   * live simulation over a few thousand points, which is the case `adaptive` and `simulate` are
   * still here for. That host writes fifteen lines against `BoundedSource`, which is exported, and
   * the day two of them write the same fifteen lines the source comes back.
   */
  it("ships no source at all, which is what one source means", () => {
    const surface = GRAPH as Record<string, unknown>;
    expect(surface.memorySource).toBeUndefined();
    expect(surface.MemoryGraph).toBeUndefined();
    // The contract stays, and it is the whole of what a host needs to write one: `BoundedSource` is
    // a type, so what stands in for its presence here is `shouldSlice`, which is the only value on
    // this barrel that speaks the bounded vocabulary.
    expect(GRAPH.shouldSlice).toBeTypeOf("function");
  });

  /**
   * `explore`, `ExploringSource` and `ExploreRequest` — the topological question, deleted.
   *
   * Two sentences, because a deletion that takes its own argument with it is how the next person
   * rediscovers what we removed.
   *
   * **A rectangle cannot express "two hops from this node", and a contract that only spoke
   * rectangles imposed the metaphor of a map on a network.** The neighbourhood was not a
   * convenience: it was added correcting a real design error, and the error is still in the shape —
   * `SliceRequest` is a rectangle and a network has no spatial near.
   *
   * **`/docs/design/graph`'s *a tile is an address, not a verb* names it as the seam fossil's
   * `expand` comes in through.** That is the whole reason it was promoted from comfort to mechanism
   * once, and it is the reason the name is worth remembering rather than reinventing.
   *
   * What removed it anyway: `memorySource` was the only implementation, and it went. A recursive CTE
   * over the edge relation was tried on 2026-08-17 and abandoned on measurement — one hop from one
   * seed over 6.9M edges did not return in 45 s, and Mosaic serialises on one connection, so it took
   * the tab with it. The right shape is the addressed one: a hop is the `by_source` and `by_target`
   * tiles the seed's `dense_id` falls in, which is two 74 kB reads the tile cache already serves, and
   * it needs `by_target` tiled the way `by_source` is — which is the corpus' side of the seam.
   *
   * **What would reverse it:** that tiling landing. Then `explore` comes back as a second method on
   * the source, not as a variant of `slice`, and this test is what says so.
   */
  it("keeps the neighbourhood question deleted, and says what it was for", () => {
    const surface = GRAPH as Record<string, unknown>;
    // `ExploringSource` and `ExploreRequest` are types and leave no binding; what stands in for them
    // is the api, which no longer publishes the verb they existed to carry.
    expect(surface.explore).toBeUndefined();
    expect(surface.ExploringSource).toBeUndefined();
    expect(surface.ExploreRequest).toBeUndefined();
  });

  /**
   * The far view was a summary and is a sample, and these are the names that went with the summary.
   *
   * They are asserted here because the thing that makes them tempting is that they *sound* right:
   * zoom out far enough and individual points stop being information, so collapse them into one
   * mark per group. Measured, that is the worst thing on the list —
   * `/docs/design/graph` carries the table, and the sentence to
   * remember is that eight super-nodes per `community` scored **worse than a uniform grey box**
   * over the corpus' own bounding box.
   */
  it("keeps the aggregate far view deleted, names and all", () => {
    const surface = GRAPH as Record<string, unknown>;
    // `SUPERNODE` was the reserved vertex type an aggregate's groups wore, so that group 3 and
    // vertex 3 were not one identity. Nothing produces a group any more, so a reserved type is a
    // hole punched in a corpus' type space for nobody.
    expect(surface.SUPERNODE).toBeUndefined();
    // `lodThreshold` was the zoom a source compared against to decide it should summarise. It had
    // already lost its anchor — it matched fossil's `viewport`, a verb that was deleted — and what
    // replaces it is arithmetic nobody has to pick: a window is sampled when it holds more than
    // `limit`, at whatever zoom that happens. It sat on `BOUNDED_DEFAULTS`, which is itself gone —
    // so this is asserted where the field would have to reappear, which is the request.
    expect(surface.lodThreshold).toBeUndefined();
    // `Viewport` carried a `zoom` for exactly one reader, and that was it. `minLinkPixels` is the
    // only thing to have joined the bounded vocabulary since, and it is a length rather than a level
    // of detail: it says how short an edge has to be before its row is not worth sending, not which
    // picture to draw. It is a field of `SliceRequest` now, so `tsc` holds its shape and
    // `use-query-loop.test.tsx` holds the fact that a source is handed it filled.
    // `SliceMode` and the `weights` branch are types, so there is no runtime binding to assert —
    // what stands in for them is `graph-model.test.ts`, "spends the ramp on the column the source
    // ranks by, and knows no second one".
  });
});
