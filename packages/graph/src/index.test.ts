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
 * `onceQuery` was exported here. Its module imports `@kanzo-tech/ui/analytics`, which statically
 * imports `@uwdata/mosaic-core`, `@uwdata/mosaic-sql` and `@uwdata/vgplot` — so
 * `import { memorySource } from "@kanzo-tech/graph"` threw ERR_MODULE_NOT_FOUND for every host that
 * had not installed a database, while `src/index.ts`, `src/duck-source.ts`, the manifest and the
 * README each promised in their own words that it would not.
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
    expect(GRAPH.useCosmosGraph).toBeTypeOf("function");
    expect(GRAPH.useGraphLook).toBeTypeOf("function");
    expect(GRAPH.useGraphOverlays).toBeTypeOf("function");
    expect(GRAPH.useGraphSelection).toBeTypeOf("function");
    expect(GRAPH.useBoundedGraph).toBeTypeOf("function");
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
    expect(GRAPH.LOOKS).toBeTypeOf("object");
    expect(GRAPH.LOOK_ORDER.length).toBeGreaterThan(0);
    expect(GRAPH.SHAPE_ORDER.length).toBeGreaterThan(0);
    expect(GRAPH.SPACE).toBeTypeOf("number");
    expect(GRAPH.GRID).toBeTypeOf("number");
    expect(GRAPH.REHEAT).toBeTypeOf("number");
    expect(GRAPH.SUPERNODE).toBeTypeOf("number");
    expect(GRAPH.BOUNDED_DEFAULTS).toBeTypeOf("object");
    expect(GRAPH.DEFAULT_DISPLAY).toBeTypeOf("object");
    expect(GRAPH.DEFAULT_SIM).toBeTypeOf("object");
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
      lodThreshold: 0,
      query: {
        kind: "region",
        view: { xMin: -Infinity, xMax: Infinity, yMin: -Infinity, yMax: Infinity, zoom: 1 },
      },
    });
    expect(slice.vertices.length).toBe(2);
    expect(GRAPH.residentOf(slice).indicesOf([GRAPH.vertexId(0, 1)])).toEqual([1]);
  });

  it("keeps the Mosaic/DuckDB half off the root barrel", () => {
    // The one-way door CLAUDE.md names, and the one this package had already crossed.
    //
    // `onceQuery` is a `MosaicClient` subclass — its module imports `@kanzo-tech/ui/analytics`,
    // which statically imports the whole Mosaic stack, all of it optional. Re-exported here it made
    // `import { memorySource } from "@kanzo-tech/graph"` throw ERR_MODULE_NOT_FOUND for anyone
    // without a database, which is the exact failure `/editor`, `/table` and `/analytics` exist to
    // prevent in `@kanzo-tech/ui`. It has no non-Mosaic caller and never had one: `duck-source.ts`
    // and two showcases are the whole set, and every one of them already holds a `Coordinator`.
    //
    // Both names live on `@kanzo-tech/graph/duckdb`. Deliberately not imported here — importing the
    // subpath from a test in this package would prove nothing (Mosaic is installed in the
    // workspace) and would make this file the thing that reaches it.
    const surface = GRAPH as Record<string, unknown>;
    expect(surface.onceQuery).toBeUndefined();
    expect(surface.duckBoundedSource).toBeUndefined();
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
    expect(GRAPH.useGraphCanvas).toBeTypeOf("function");
    // The hooks stay beside it, which is the whole shape of the concession: a host needing a policy
    // the component does not impose reaches for these, as `useChart` sits beside `ChartRoot`.
    expect(GRAPH.useCosmosGraph).toBeTypeOf("function");
    expect(GRAPH.useBoundedGraph).toBeTypeOf("function");
    // ADR-0001. `load()` read the whole relation into memory — every id, every row, an id→index map
    // — which made the working set N and the ceiling whatever N the machine could hold. A source
    // answers a bounded question instead, and `Loaded` went with it.
    expect(surface.load).toBeUndefined();
    expect(surface.Loaded).toBeUndefined();
    expect(GRAPH.memorySource).toBeTypeOf("function");
  });
});
