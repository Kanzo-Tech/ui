import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * The layers of `/docs/design/graph`, held where they can be read off the source: one reader, which
 * is fossil's, reached through its types alone — `core/corpus-contract.ts` stands in for them until
 * `fossil/1` is published, and is held to the same rule; no module past the size a named reference is
 * the shape of; and a core that knows nothing of React or cosmos.gl.
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

/** fossil's reader, or the file that stands in for it until `fossil/1` is published. */
const FOSSIL = (from: string) => from === "@fossil-lang/corpus" || /(^|\/)corpus-contract$/.test(from);

describe("the graph's layers", () => {
  it("scans a corpus that has not quietly shrunk", () => {
    expect(modules.length).toBeGreaterThan(20);
    for (const { name, text } of modules) expect(text.includes("\0"), `${name} contains a NUL byte`).toBe(false);
  });

  it("writes no SQL, and reaches fossil only through its types", () => {
    const offenders: string[] = [];
    for (const { name, text } of modules) {
      const visit = (node: ts.Node): void => {
        if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node)) && SQL.test(node.text)) {
          offenders.push(`${name}: SQL in a string — ${node.text.slice(0, 60)}`);
        }
        if (name.endsWith("corpus-contract.ts") && (ts.isFunctionDeclaration(node) || ts.isVariableStatement(node) || ts.isClassDeclaration(node))) {
          offenders.push(`${name}: the stand-in for fossil's types declares a value`);
        }
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          const from = node.moduleSpecifier.text;
          const clause = node.importClause;
          if (from.startsWith("@uwdata/mosaic-sql")) offenders.push(`${name}: imports ${from}`);
          if (FOSSIL(from) && clause && !clause.isTypeOnly) {
            const named = clause.namedBindings;
            if (clause.name || !named || !ts.isNamedImports(named)) offenders.push(`${name}: imports fossil's door as a value`);
            else
              for (const element of named.elements) {
                if (!element.isTypeOnly) offenders.push(`${name}: imports ${(element.propertyName ?? element.name).text} from fossil as a value`);
              }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(parse(name, text));
    }
    expect(offenders, "the view asks fossil; it never writes the query itself").toEqual([]);
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
