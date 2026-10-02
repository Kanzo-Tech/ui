import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * The layers of `/docs/design/graph`, held where they can be read off the source: the graph reads a
 * corpus fossil attached as a catalog, with SQL through the page's coordinator, and imports nothing of
 * fossil's; every statement is written in the two modules that read; no module past the size a named
 * reference is the shape of; and a core that knows nothing of React or cosmos.gl.
 *
 * What it cannot prove: a query assembled from fragments no one of which looks like SQL, or a value
 * reached through a re-export under another name. It reads literals and import declarations, and
 * nothing else.
 */

const SRC = dirname(fileURLToPath(import.meta.url));
const modules = (readdirSync(SRC, { recursive: true }) as string[])
  .filter((name) => /\.tsx?$/.test(name) && !name.includes(".test."))
  .map((name) => ({ name, text: readFileSync(join(SRC, name), "utf8") }));

const parse = (name: string, text: string) =>
  ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

/** Upper-case, as every query this package ever wrote spelled them — prose says "where" too. */
const SQL = /\b(SELECT|FROM|WHERE|JOIN|CREATE (OR REPLACE )?(VIEW|TABLE))\s|read_parquet|parquet_metadata/;

/** The two modules that read: the structure and rows, and the crossfilter's client. */
const READERS = new Set(["core/source.ts", "core/client.ts"]);

describe("the graph's layers", () => {
  it("scans a corpus that has not quietly shrunk", () => {
    expect(modules.length).toBeGreaterThan(20);
    for (const { name, text } of modules) expect(text.includes("\0"), `${name} contains a NUL byte`).toBe(false);
  });

  it("writes SQL only where it reads, and imports nothing of fossil's", () => {
    const offenders: string[] = [];
    for (const { name, text } of modules) {
      const visit = (node: ts.Node): void => {
        const literal = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node);
        if (literal && SQL.test(node.text) && !READERS.has(name)) offenders.push(`${name}: SQL in a string — ${node.text.slice(0, 60)}`);
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          const from = node.moduleSpecifier.text;
          if (from.startsWith("@uwdata/")) offenders.push(`${name}: imports ${from}, which @kanzo-tech/mosaic re-exports`);
          if (from.startsWith("@fossil-lang/")) offenders.push(`${name}: imports ${from}; the contract is the attached catalog`);
        }
        ts.forEachChild(node, visit);
      };
      visit(parse(name, text));
    }
    expect(offenders).toEqual([]);
    // Both readers do write SQL, so the rule above is not passing because the pattern went blind.
    for (const reader of READERS) expect(SQL.test(modules.find((m) => m.name === reader)?.text ?? ""), reader).toBe(true);
  });

  it("keeps every module under four hundred lines", () => {
    const long = modules
      .map(({ name, text }) => ({ name, lines: text.split("\n").length }))
      .filter(({ lines }) => lines > 400)
      .map(({ lines, name }) => `${name}: ${lines} lines`);
    expect(long, "a module past the budget is a layer doing a second layer's work").toEqual([]);
  });

  it("keeps the core free of React and of cosmos.gl", () => {
    const offenders: string[] = [];
    for (const { name, text } of modules.filter((m) => m.name.startsWith("core"))) {
      const visit = (node: ts.Node): void => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          const from = node.moduleSpecifier.text;
          const typeOnly = node.importClause?.isTypeOnly ?? false;
          if (from === "react" || from.startsWith("@cosmos.gl/")) offenders.push(`${name}: imports ${from}`);
          if (from.startsWith("../") && !typeOnly) offenders.push(`${name}: imports ${from} as a value`);
        }
        ts.forEachChild(node, visit);
      };
      visit(parse(name, text));
    }
    expect(offenders).toEqual([]);
  });
});
