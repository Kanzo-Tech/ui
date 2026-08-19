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
 * `slice-client.ts` replaced it with a client the coordinator owns. It is still asserted below,
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
 * - **Nothing about shape.** `toBeTypeOf("function")` is satisfied by any function; the one
 *   behavioural assertion below is `memorySource` answering a slice, and it is there to prove the
 *   no-database path *works* rather than merely resolves.
 * - **Nothing about types.** `export type` contributes no runtime binding, so `Slice`, `Look`,
 *   `VertexId` and the rest of the type surface are outside this file by construction.
 * - **It is an enumeration, not a pin.** No `Object.keys` comparison and no snapshot: adding an
 *   export never fails this file, and removing one fails only if the name is written below.
 * - **It cannot tell a tombstone from a name nobody has written yet.** `toBeUndefined()` reads the
 *   same for both. The comment above each is the only thing carrying the reason.
 */
describe("@kanzo-tech/graph public surface", () => {
  it("exposes the render path, which is the package", () => {
    expect(GRAPH.buffers).toBeTypeOf("function");
    expect(GRAPH.scaleOf).toBeTypeOf("function");
    expect(GRAPH.forces).toBeTypeOf("function");
    expect(GRAPH.appearance).toBeTypeOf("function");
    expect(GRAPH.neighboursOf).toBeTypeOf("function");
    expect(GRAPH.useGraphOverlays).toBeTypeOf("function");
    expect(GRAPH.useGraphSelection).toBeTypeOf("function");
    expect(GRAPH.clusterRing).toBeTypeOf("function");
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
    // resolved here — `decisions/a-look-declares-what-it-changes.md`.
    expect(GRAPH.lookFrom).toBeTypeOf("function");
    expect(GRAPH.DEFAULT_LOOK.size.length).toBe(2);
    expect(GRAPH.SHAPE_ORDER.length).toBeGreaterThan(0);
    // Tombstone. `SPACE = 4096` was the renderer's coordinate box declared here and owned by
    // whatever wrote the positions; a corpus fossil wrote spans 157× it and nothing failed, because
    // `spaceSize` is a translation in every render path. The box is the source's `extent()` now, set
    // where `useBoundedGraph` already awaits one — `coordinate-box.test.ts` is the guard.
    expect((GRAPH as Record<string, unknown>).SPACE).toBeUndefined();
    expect(GRAPH.GRID).toBeTypeOf("number");
    expect(GRAPH.REHEAT).toBeTypeOf("number");
    expect(GRAPH.BOUNDED_DEFAULTS).toBeTypeOf("object");
    // The forces have a builder, exactly as the look does, and `DEFAULT_SIM` is that builder called
    // with nothing. There is no `DEFAULT_DISPLAY` and no successor to it: a second vocabulary for
    // the picture is what `lookFrom` replaced.
    expect(GRAPH.simFrom).toBeTypeOf("function");
    expect(GRAPH.DEFAULT_SIM).toEqual(GRAPH.simFrom());
    expect((GRAPH as Record<string, unknown>).DEFAULT_DISPLAY).toBeUndefined();
  });

  it("draws a graph from arrays a host already holds, with no database anywhere", async () => {
    // The promise the package makes in four places, exercised rather than restated. `memorySource`
    // is on the root barrel precisely because this path must not reach Mosaic.
    const source = GRAPH.memorySource({
      vertices: new BigUint64Array([GRAPH.vertexId(0, 0), GRAPH.vertexId(0, 1)]),
      positions: new Float32Array([0, 0, 1, 1]),
      links: new Float32Array([0, 1]),
    });
    const slice = await source.slice({
      limit: 10,
      view: { xMin: -Infinity, xMax: Infinity, yMin: -Infinity, yMax: Infinity },
    });
    expect(slice.vertices.length).toBe(2);
    expect(GRAPH.residentOf(slice).indicesOf([GRAPH.vertexId(0, 1)])).toEqual([1]);
  });

  it("keeps the Mosaic/DuckDB half off the root barrel", () => {
    // The one-way door CLAUDE.md names, and the one this package had already crossed.
    //
    // `onceQuery` was a `MosaicClient` subclass — its module imported `@kanzo-tech/ui/analytics`,
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
    expect(surface.duckBoundedSource).toBeUndefined();
    expect(surface.openCorpus).toBeUndefined();
    expect(surface.SliceRead).toBeUndefined();
    // The client is not here under any name either. It lives in `@kanzo-tech/ui/analytics` as
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
    // `decisions/an-export-needs-a-second-call-site.md` decides that case, and there is no carve-out
    // to reach for: the reference is silent about graphs, so the house principle is all there is.
    // `resolveToken` and `toHex` stay — both are called by `graph-model.ts` and by the benchmark
    // showcase, and they are the shared answer to "what colour is `var(--primary)` here", which is
    // the question a host writing its own buffers has to answer the same way the canvas does.
    expect(surface.withAlpha).toBeUndefined();
    expect(GRAPH.resolveToken).toBeTypeOf("function");
    expect(GRAPH.toHex).toBeTypeOf("function");
  });

  it("ships a canvas that owns the renderer, and neither load nor Loaded", () => {
    const surface = GRAPH as Record<string, unknown>;
    // This assertion was the reverse of itself, and the reversal is the record rather than a fix:
    // `decisions/a-canvas-component-owns-the-three-that-never-differ.md`. What the old argument got
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
    // `decisions/a-chart-needs-no-factory.md`: there is no `useChart` factory, so charts ship exactly
    // one way and the reference this copied no longer reads that way. Measured after the workspace
    // migrated to `useGraph`: zero call sites outside this package, comments aside.
    expect(surface.useCosmosGraph).toBeUndefined();
    expect(surface.useBoundedGraph).toBeUndefined();
    expect(surface.useGraphLook).toBeUndefined();
    // ADR-0001. `load()` read the whole relation into memory — every id, every row, an id→index map
    // — which made the working set N and the ceiling whatever N the machine could hold. A source
    // answers a bounded question instead, and `Loaded` went with it.
    expect(surface.load).toBeUndefined();
    expect(surface.Loaded).toBeUndefined();
    expect(GRAPH.memorySource).toBeTypeOf("function");
  });

  /**
   * The far view was a summary and is a sample, and these are the names that went with the summary.
   *
   * They are asserted here because the thing that makes them tempting is that they *sound* right:
   * zoom out far enough and individual points stop being information, so collapse them into one
   * mark per group. Measured, that is the worst thing on the list —
   * `decisions/a-far-view-is-a-sample-not-a-summary.md` carries the table, and the sentence to
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
    // `limit`, at whatever zoom that happens.
    expect((GRAPH.BOUNDED_DEFAULTS as Record<string, unknown>).lodThreshold).toBeUndefined();
    // `Viewport` carried a `zoom` for exactly one reader, and that was it. `minLinkPixels` is the
    // only thing to have joined it since, and it is a length rather than a level of detail: it says
    // how short an edge has to be before its row is not worth sending, not which picture to draw.
    expect(Object.keys(GRAPH.BOUNDED_DEFAULTS)).toEqual(["limit", "minLinkPixels"]);
    // `SliceMode` and the `weights` branch are types, so there is no runtime binding to assert —
    // what stands in for them is `graph-model.test.ts`, "spends the ramp on the column the source
    // ranks by, and knows no second one".
  });

  /**
   * The behaviour the deletion is for, on the one source that needs no database.
   *
   * A window holding more than `limit` used to come back as its first `limit` rows in id order,
   * which is a *contiguous run* of whatever that order follows — a corner of the window drawn as if
   * it were the window. This is the assertion that a sample is spread over what it samples.
   */
  it("samples a window it cannot fit rather than drawing the front of it", async () => {
    // A thousand points on a line, in order. `limit` 10 must reach the far end; a prefix stops at 9.
    const n = 1000;
    const positions = new Float32Array(n * 2);
    const vertices = new BigUint64Array(n);
    for (let i = 0; i < n; i++) {
      positions[i * 2] = i;
      vertices[i] = GRAPH.vertexId(0, i);
    }
    const source = GRAPH.memorySource({ vertices, positions, links: new Float32Array(0) });
    const slice = await source.slice({
      limit: 10,
      view: { xMin: -Infinity, xMax: Infinity, yMin: -Infinity, yMax: Infinity },
    });

    expect(slice.vertices.length).toBe(10);
    // What matched is still reported whole: the sample is how it draws, not what it claims.
    expect(slice.n).toBe(n);
    const xs = [...slice.positions].filter((_, i) => i % 2 === 0);
    expect(Math.min(...xs)).toBe(0);
    // One in every hundred, so the tenth is at 900. A prefix answers 9 — the first hundredth of the
    // window, drawn as if it were the window.
    expect(Math.max(...xs)).toBe(900);
  });
});
