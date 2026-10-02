import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * **The box cosmos.gl draws in is decided in one place, never written as a number where it is used.**
 *
 * The rule is the general one: a constant is legitimate when this side owns the fact. With `x` and
 * `y` bound, the data owns it — the renderer frames the positions' extent. Unbound, the layout's
 * square is this package's own, and it is one function, `spaceFor` in `core/load.ts`, measured on
 * the gate in `/docs/graph/layout`. There was once an `export const SPACE = 4096` that a corpus
 * fossil wrote ignored completely — a million vertices spanning 157× that box — and nothing failed,
 * because `spaceSize` enters every cosmos.gl render path as a translation. **The failure mode of the
 * thing this guards is that there is no failure**: a false statement, silently.
 *
 * So: no numeric `spaceSize` anywhere in the package, and no `SPACE` constant to copy.
 *
 * **What this cannot prove.** It sees a numeric literal, not a number: `spaceSize: FOUR_THOUSAND`
 * passes, and so does `spaceSize: n * 2`. The literal is the spelling every instance of this mistake
 * has actually worn. Nor can it prove the box that is set is right — only a live tab can.
 */

const SOURCE_DIR = dirname(fileURLToPath(import.meta.url));

function sourcesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourcesUnder(path));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(path);
  }
  return found;
}

describe("the coordinate box is decided in one place", () => {
  const files = sourcesUnder(SOURCE_DIR);

  // A guard that can silently stop seeing its corpus reports the same green as a real pass. Both
  // halves: the corpus is not empty, and nothing in it is unreadable as text.
  it("scans a corpus that has not quietly shrunk", () => {
    expect(files.length).toBeGreaterThan(15);
    for (const file of files) {
      expect(readFileSync(file).includes(0), `${file} contains a NUL byte`).toBe(false);
    }
  });

  it("never writes a number where cosmos.gl asks what the space is", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const visit = (node: ts.Node): void => {
        if (
          ts.isPropertyAssignment(node) &&
          ts.isIdentifier(node.name) &&
          node.name.text === "spaceSize" &&
          (ts.isNumericLiteral(node.initializer) ||
            (ts.isPrefixUnaryExpression(node.initializer) &&
              ts.isNumericLiteral(node.initializer.operand)))
        ) {
          offenders.push(`${file}: spaceSize: ${node.initializer.getText()}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(offenders, "the box is the data's extent or `spaceFor`; see the renderer's `position`").toEqual([]);
  });

  it("declares no coordinate-space constant of its own", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = ts.createSourceFile(
        file,
        readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const visit = (node: ts.Node): void => {
        if (
          ts.isVariableDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          /^(SPACE|SPACE_SIZE|SPACESIZE)$/.test(node.name.text)
        ) {
          offenders.push(`${file}: ${node.name.text}`);
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    expect(offenders, "`SPACE` was the box this side declared and the other side owned").toEqual([]);
  });
});
