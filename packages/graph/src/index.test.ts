import { describe, expect, it } from "vitest";
import * as GRAPH from "./index";

/**
 * What `import { … } from "@kanzo-tech/graph"` is allowed to find, and what it must not.
 *
 * Two halves, as in `packages/ui/src/index.test.ts`: a positive set that catches a module which
 * fails to load or a name two modules both export, and tombstones that carry the argument which
 * removed a name. `/docs/design/graph` argues from several of these absences, and cites them.
 *
 * What it cannot prove: the barrel's *type* exports are erased before this runs, so `pnpm
 * typecheck` over the docs is what holds those.
 */
const VALUES = [
  "GraphCanvas",
  "GraphRoot",
  "GraphRootProvider",
  "ShapeGlyph",
  "adaptive",
  "denseOf",
  "lookFrom",
  "scaleOf",
  "simFrom",
  "typeOf",
  "useGraph",
  "useGraphContext",
  "useGraphPrefs",
  "vertexId",
];

const surface = GRAPH as Record<string, unknown>;

describe("@kanzo-tech/graph public surface", () => {
  it("is exactly this list, and grows only by somebody writing a name into it", () => {
    expect(Object.keys(GRAPH).sort()).toEqual(VALUES);
  });

  it("is Ark's four: useGraph creates, GraphRoot provides, GraphRootProvider takes, useGraphContext reads", () => {
    expect(GRAPH.useGraph).toBeTypeOf("function");
    expect(GRAPH.GraphRoot).toBeTypeOf("function");
    expect(GRAPH.GraphRootProvider).toBeTypeOf("function");
    expect(GRAPH.useGraphContext).toBeTypeOf("function");
    expect(surface.useGraphCanvas).toBeUndefined();
  });

  // The second reader. `openCorpus` composed tile URLs from fossil's addressing, read footers for
  // boxes and wrote the window's SQL; fossil's `open` and `scan` answer the same questions from the
  // manifest they wrote. There is one door, and it is fossil's.
  it("keeps the second reader deleted: no opener, no source, no slice", () => {
    expect(surface.openCorpus).toBeUndefined();
    expect(surface.OpenedCorpus).toBeUndefined();
    expect(surface.DuckSource).toBeUndefined();
    expect(surface.EdgeRelation).toBeUndefined();
    expect(surface.UndrawnRelation).toBeUndefined();
    expect(surface.BoundedSource).toBeUndefined();
    expect(surface.shouldSlice).toBeUndefined();
    expect(surface.SliceRead).toBeUndefined();
    expect(surface.useQueryLoop).toBeUndefined();
    expect(surface.memorySource).toBeUndefined();
  });

  it("keeps the Mosaic stack off the barrel as a name, though it is a required peer now", () => {
    expect(surface.onceQuery).toBeUndefined();
    expect(surface.CosmosClient).toBeUndefined();
    expect(surface.IdSetClient).toBeUndefined();
  });

  // The canvas draws its overlays and its gesture itself; a host reaches the renderer through the
  // api's `getGraph` and `getResident`, and builds no map of its own.
  it("keeps the canvas's own steps internal", () => {
    expect(surface.useGraphOverlays).toBeUndefined();
    expect(surface.useGraphSelection).toBeUndefined();
    expect(surface.cursorChip).toBeUndefined();
    expect(surface.residentOf).toBeUndefined();
    expect(surface.neighboursOf).toBeUndefined();
    expect(surface.resolveToken).toBeUndefined();
    expect(surface.toHex).toBeUndefined();
    expect(surface.useRenderer).toBeUndefined();
    expect(surface.createGraph).toBeUndefined();
    expect(surface.buffers).toBeUndefined();
    expect(surface.paint).toBeUndefined();
    expect(surface.isColour).toBeUndefined();
    expect(surface.clusterRing).toBeUndefined();
  });

  it("names its glyphs instead of publishing cosmos.gl's enum", () => {
    expect(surface.SHAPE).toBeUndefined();
    expect(surface.SHAPE_PATH).toBeUndefined();
    expect(GRAPH.scaleOf({ symbol: "kind" }).shape(0)).toBe("circle");
    expect(GRAPH.scaleOf({ symbol: "kind" }).shape(4)).toBe("cross");
  });

  it("merges its own defaults instead of publishing them to be spread", () => {
    expect(surface.DEFAULT_LOOK).toBeUndefined();
    expect(surface.DEFAULT_SIM).toBeUndefined();
    expect(surface.DEFAULT_LIMIT).toBeUndefined();
    expect(surface.REHEAT).toBeUndefined();
    expect(surface.GRID).toBeUndefined();
    expect(surface.SPACE).toBeUndefined();
    expect(GRAPH.lookFrom({ marks: "legible" }).size).toEqual([4, 13]);
    expect(GRAPH.simFrom({ gravity: "0.5" }).gravity).toBe(0.5);
  });

  it("ships a canvas that owns the renderer, and neither load nor Loaded", () => {
    expect(GRAPH.GraphCanvas).toBeTypeOf("function");
    expect(surface.load).toBeUndefined();
    expect(surface.Loaded).toBeUndefined();
  });

  it("keeps the neighbourhood question deleted, and says what it was for", () => {
    // A verb on the drawing path is `viewport` again under another name: the camera is addressed.
    expect(surface.explore).toBeUndefined();
    expect(surface.ExploringSource).toBeUndefined();
    expect(surface.ExploreRequest).toBeUndefined();
  });

  it("keeps the aggregate far view deleted, names and all", () => {
    // A far view is a coarser zoom of fossil's cell pyramid; nothing groups by a column.
    expect(surface.SUPERNODE).toBeUndefined();
    expect(surface.lodThreshold).toBeUndefined();
  });
});
