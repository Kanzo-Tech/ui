import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * The coordinate box is the corpus's, and this package may not declare one.
 *
 * The rule it enforces is the general one: **a constant is legitimate when this side owns the
 * fact.** The box a renderer draws into is owned by whatever wrote the positions — fossil, a
 * generator, a host with arrays in hand — so a number here that names it is this side writing what
 * the other side owns. There was one: `export const SPACE = 4096`, passed to cosmos.gl as
 * `spaceSize` and hand-copied into both bench generators. A corpus fossil wrote ignored it
 * completely — a million vertices span about x ∈ [−345, 645396], 157× that box — and nothing failed,
 * because `spaceSize` enters every cosmos.gl render path as a translation and the camera is fitted
 * from the extent anyway. **The failure mode of the thing this guards is that there is no failure**:
 * a false statement, silently.
 *
 * So: no numeric `spaceSize` anywhere in the package, and no `SPACE` on the barrel. What replaces it
 * is `useBoundedGraph`'s framing, which already awaits `extent()` and sets the box from it.
 *
 * **What this cannot prove.** Three things, and they are the reason it is a small guard:
 * - It cannot prove the box that *is* set is right. `spaceSize` is a translation in every render
 *   path, so a wrong one is invisible to a screenshot as much as to a test; only comparing
 *   `graph.config.spaceSize` against a source's `extent()` in a live tab does that.
 * - It sees this package only. The bench generators under `docs/showcases/graph-bench/corpus/` still
 *   pick a square to write into, correctly — it is theirs — and nothing here can tell a generator's
 *   own number from a copy of ours. Deleting the export is what makes a copy impossible.
 * - It sees a numeric literal, not a number. `spaceSize: FOUR_THOUSAND` passes, and so does
 *   `spaceSize: n * 2`. The literal is the spelling every instance of this mistake has actually
 *   worn, here and in `CHUNK_SIZE` before it.
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

describe("the coordinate box is the corpus's, not a constant of this package's", () => {
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
    expect(offenders, "the box comes from `extent()`; see `useBoundedGraph`'s framing").toEqual([]);
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
