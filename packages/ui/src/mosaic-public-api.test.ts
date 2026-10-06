import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { label, SHIPPED, sourceFiles } from "./guard-corpus.js";

/**
 * **Mosaic through its public surface only.** Mosaic leaves its internals unmarked — mosaic-core's
 * `_relay`, `_resolved` and `_filterBy`, mosaic-sql's `_select` and `_groupby` on a query, and the
 * rest carry no `private` and sit in the emitted `.d.ts` — so the compiler lets any package reach
 * them, and a Mosaic release may change any of them without a word. This reads every shipped
 * package's sources with the type checker and fails on any `_`-named member declared under
 * `@uwdata/`: mosaic-core, mosaic-sql, mosaic-plot, vgplot and flechette alike.
 *
 * The population is `SHIPPED`, not the packages that declare a Mosaic dependency: `graph` and `ai`
 * reach Mosaic objects through `@kanzo-tech/mosaic`, so their manifests name it only as a dev
 * dependency, and a package with no Mosaic in it costs a parse and reports nothing.
 *
 * What it cannot see: a member reached through `any`, or by a computed key the checker cannot
 * resolve; a test file, which `sourceFiles` leaves out; and `docs/`, which ships nothing.
 */

const files = sourceFiles(/\.tsx?$/, SHIPPED);
const MOSAIC = "/@uwdata/";

const OPTIONS: ts.CompilerOptions = {
  noEmit: true,
  skipLibCheck: true,
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
};

/** Every `_` member of Mosaic reached in `paths`; `virtual` adds files that exist only here. */
function internals(paths: readonly string[], virtual: Record<string, string> = {}): string[] {
  const host = ts.createCompilerHost(OPTIONS);
  const read = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, language, ...rest) =>
    fileName in virtual ? ts.createSourceFile(fileName, virtual[fileName]!, language, true) : read(fileName, language, ...rest);
  const exists = host.fileExists.bind(host);
  host.fileExists = (fileName) => fileName in virtual || exists(fileName);
  const program = ts.createProgram(paths, OPTIONS, host);
  const checker = program.getTypeChecker();
  const found: string[] = [];
  for (const file of program.getSourceFiles().filter((f) => paths.includes(f.fileName))) {
    const visit = (node: ts.Node): void => {
      const name = ts.isPropertyAccessExpression(node)
        ? node.name
        : ts.isBindingElement(node)
          ? (node.propertyName ?? node.name)
          : ts.isElementAccessExpression(node)
            ? node.argumentExpression
            : undefined;
      const text = name && (ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined);
      if (name && text?.startsWith("_")) {
        // A destructured name is a local: the member is the property of the pattern's type.
        const symbol = ts.isBindingElement(node)
          ? checker.getTypeAtLocation(node.parent).getProperty(text)
          : checker.getSymbolAtLocation(name);
        const declared = symbol?.declarations ?? [];
        if (declared.some((d) => d.getSourceFile().fileName.includes(MOSAIC))) {
          const { line } = file.getLineAndCharacterOfPosition(node.getStart());
          found.push(`${label(file.fileName)}:${line + 1} ${text}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return found;
}

describe("the public surface of Mosaic", () => {
  it("reaches no underscore member of a Mosaic object in any shipped package", () => {
    for (const needed of ["ui/charts/", "graph/", "mosaic/"]) expect(files.some((f) => label(f).startsWith(needed))).toBe(true);
    expect(internals(files)).toEqual([]);
  });

  it("is not blind: it sees a relay reached, a resolved list read, a filter group destructured and a query's grouping read", () => {
    const probe = join(SHIPPED.find((root) => root.name === "ui")!.src, "probe.ts");
    const source = [
      `import { Selection, MosaicClient } from "@uwdata/mosaic-core";`,
      `import { Query } from "@uwdata/mosaic-sql";`,
      `const s = Selection.crossfilter();`,
      `s._relay.add(s);`,
      `const n = s["_resolved"].length;`,
      `const { _filterBy } = new MosaicClient(s);`,
      `const g = Query.from("t").select("a")._groupby;`,
      `const mine = { _own: 1 }._own;`,
      `export { n, _filterBy, g, mine };`,
    ].join("\n");
    expect(internals([probe], { [probe]: source })).toEqual([
      "ui/probe.ts:4 _relay",
      "ui/probe.ts:5 _resolved",
      "ui/probe.ts:6 _filterBy",
      "ui/probe.ts:7 _groupby",
    ]);
  });
});
