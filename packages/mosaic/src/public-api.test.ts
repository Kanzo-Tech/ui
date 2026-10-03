import { readdirSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * **Mosaic through its public surface only.** mosaic-core leaves its internals unmarked — `_relay`,
 * `_resolved`, `_filterBy` and the rest carry no `private` and sit in the emitted `.d.ts` — so the
 * compiler lets this package reach them, and a release of mosaic-core may change any of them without
 * a word. This reads every module here, tests included, with the type checker, and fails on any
 * `_`-named member whose declaration is mosaic-core's.
 *
 * What it cannot see: a member reached through `any`, or by a computed key the checker cannot resolve.
 */

const SRC = dirname(fileURLToPath(import.meta.url));
const files = (readdirSync(SRC, { recursive: true }) as string[]).filter((f) => /\.tsx?$/.test(f)).map((f) => join(SRC, f));
const MOSAIC_CORE = `${sep}@uwdata${sep}mosaic-core${sep}`;

const OPTIONS: ts.CompilerOptions = {
  noEmit: true,
  skipLibCheck: true,
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
};

/** Every `_` member of mosaic-core reached in `paths`; `virtual` adds files that exist only here. */
function internals(paths: readonly string[], virtual: Record<string, string> = {}, root = SRC): string[] {
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
        if (declared.some((d) => d.getSourceFile().fileName.includes(MOSAIC_CORE.replaceAll(sep, "/")))) {
          const { line } = file.getLineAndCharacterOfPosition(node.getStart());
          found.push(`${file.fileName.slice(root.length + 1)}:${line + 1} ${text}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return found;
}

describe("the public surface of mosaic-core", () => {
  it("reaches no underscore member of a mosaic-core object anywhere in this package", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(internals(files)).toEqual([]);
  });

  it("is not blind: it sees a relay reached, a resolved list read, and a filter group destructured", () => {
    const probe = join(SRC, "probe.ts");
    const source = [
      `import { Selection, MosaicClient } from "@uwdata/mosaic-core";`,
      `const s = Selection.crossfilter();`,
      `s._relay.add(s);`,
      `const n = s["_resolved"].length;`,
      `const { _filterBy } = new MosaicClient(s);`,
      `const mine = { _own: 1 }._own;`,
      `export { n, _filterBy, mine };`,
    ].join("\n");
    expect(internals([probe], { [probe]: source })).toEqual(["probe.ts:3 _relay", "probe.ts:4 _resolved", "probe.ts:5 _filterBy"]);
  });
});
