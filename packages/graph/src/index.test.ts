import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
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
  "GraphInspector",
  "GraphLegend",
  "GraphRoot",
  "GraphRootProvider",
  "GraphToolbar",
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
  "useGraphState",
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

  it("ships the parts flat, each reading the one context", () => {
    for (const part of ["GraphCanvas", "GraphLegend", "GraphToolbar", "GraphInspector"]) {
      expect(surface[part], part).toBeTypeOf("function");
    }
    expect(surface.GraphSelection).toBeUndefined();
    expect(surface.GraphZoom).toBeUndefined();
    expect(surface.GraphCounts).toBeUndefined();
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

/**
 * **The parts own the vocabulary; the root owns the policy.** What a click means, what a lasso
 * commits to and what a failure shows are `onSelect`, `onFocus` and `onFailure` on the root, and a
 * part that grew a callback of its own would be a second place for a product's policy to live. Read
 * with the type checker off the barrel's exports, so a callback inherited from a DOM element — the
 * `onClick` every `div` carries — is told apart from one a part declared.
 *
 * What it cannot prove: a render prop that is a policy in disguise. `children` is allowed to be a
 * function, because a render prop draws markup; one that returned a verdict would pass.
 */
describe("the parts' props", () => {
  const SRC = dirname(fileURLToPath(import.meta.url));
  const ROOT_PROPS = new Set(["GraphRootProps", "GraphRootProviderProps", "UseGraphProps"]);

  // A whole program through the checker: about a second here and past vitest's 5 s default on a
  // CI runner, which is how v0.11.0's first publish failed. The budget is for the checker, not the
  // assertion.
  it("carry no callback but the root's", () => {
    const program = ts.createProgram([join(SRC, "index.ts")], {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
      strict: true,
      skipLibCheck: true,
      noEmit: true,
    });
    const checker = program.getTypeChecker();
    const barrel = program.getSourceFile(join(SRC, "index.ts"));
    if (!barrel) throw new Error("the barrel did not parse");
    const exports = checker.getExportsOfModule(checker.getSymbolAtLocation(barrel) as ts.Symbol);
    const props = exports.filter((symbol) => symbol.name.endsWith("Props") && !ROOT_PROPS.has(symbol.name));
    expect(props.map((symbol) => symbol.name).sort()).toEqual([
      "GraphCanvasProps",
      "GraphInspectorProps",
      "GraphLegendProps",
      "GraphToolbarProps",
      "ShapeGlyphProps",
    ]);
    const offenders: string[] = [];
    for (const symbol of props) {
      const type = checker.getDeclaredTypeOfSymbol(checker.getAliasedSymbol(symbol));
      for (const property of type.getProperties()) {
        const ours = property.declarations?.some((d) => d.getSourceFile().fileName.startsWith(SRC)) ?? false;
        if (!ours || property.name === "children") continue;
        const declaration = property.valueDeclaration ?? property.declarations?.[0];
        const shape = declaration ? checker.getTypeOfSymbolAtLocation(property, declaration) : undefined;
        const callable = shape?.getNonNullableType().getCallSignatures().length ?? 0;
        if (callable > 0 || /^on[A-Z]/.test(property.name)) offenders.push(`${symbol.name}.${property.name}`);
      }
    }
    expect(offenders, "a part's callback is a second home for the host's policy").toEqual([]);
  }, 60_000);
});
