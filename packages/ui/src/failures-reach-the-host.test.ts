import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { label, REPO, SHIPPED, sourceFiles, unreadable } from "./guard-corpus";

/**
 * The guards fossil's `/docs/design/failure` assigns to this repository, over {@link SHIPPED}: every
 * shipped package, because whether a rejection is swallowed has nothing to do with how a package
 * draws. Each rule says what it cannot prove beside it.
 */

const FILES = sourceFiles(/\.tsx?$/, SHIPPED);
const parsed = FILES.map((file) => ({
  file,
  source: ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true),
}));

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  node.forEachChild((child) => walk(child, visit));
}

function at(source: ts.SourceFile, node: ts.Node): string {
  return `${label(source.fileName)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`;
}

const COMMENT = /\/\/|\/\*/;

/** A comment on the line the node ends on, or inside it. */
function reasoned(source: ts.SourceFile, node: ts.Node): boolean {
  const text = source.text;
  const end = node.getEnd();
  const lineEnd = text.indexOf("\n", end);
  return COMMENT.test(node.getText(source)) || COMMENT.test(text.slice(end, lineEnd < 0 ? undefined : lineEnd));
}

function isEmptyHandler(node: ts.Node): boolean {
  if (!ts.isArrowFunction(node) && !ts.isFunctionExpression(node)) return false;
  const body = node.body;
  if (ts.isBlock(body)) return body.statements.length === 0;
  return (
    body.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isIdentifier(body) && body.text === "undefined") ||
    ts.isVoidExpression(body)
  );
}

describe("the corpus", () => {
  it("is every shipped package, readable", () => {
    expect(SHIPPED.map((root) => root.name)).toEqual(expect.arrayContaining(["ai", "auth", "graph", "mosaic", "ui"]));
    expect(unreadable(FILES)).toEqual({ binary: [], empty: [] });
  });
});

/**
 * **A failure is never dropped without a reason on the line** — an empty `catch {}`, or a
 * `.catch(() => {})` / `.catch(() => undefined)`. The reasons the page admits are a cancellation,
 * a chain that only orders the next step while the caller holds the promise, and the cleanup after a
 * failure already being reported.
 *
 * Cannot prove: that the reason is true; a `catch` that returns a fallback (`catch { return null }`)
 * rather than nothing, which is a decision and reads like one; a second argument to `.then`.
 */
describe("no failure is swallowed without a reason", () => {
  it("bites on an empty catch or an empty .catch handler with no comment on the line", () => {
    const silent: string[] = [];
    for (const { source } of parsed) {
      walk(source, (node) => {
        if (ts.isCatchClause(node) && node.block.statements.length === 0 && !reasoned(source, node.block)) {
          silent.push(at(source, node));
        }
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "catch" &&
          node.arguments.length === 1 &&
          isEmptyHandler(node.arguments[0]!) &&
          !reasoned(source, node)
        ) {
          silent.push(at(source, node));
        }
      });
    }
    expect(silent).toEqual([]);
  });
});

/**
 * **No `??=` assigns a promise.** `cache ??= load()` keeps a rejected promise as faithfully as a
 * resolved one, and one transient failure poisons every later call for the life of the page. The
 * types decide, not the spelling: every file holding a `??=` is type-checked with what it imports.
 *
 * Cannot prove: a memoization spelled another way — `if (!cache) cache = load()`, a `Map` of
 * promises. A right-hand side typed `any` is reported rather than passed, because an import that did
 * not resolve (an unbuilt sibling package) would otherwise hide a promise.
 */
describe("no rejection is memoized", () => {
  it("bites on ??= whose right-hand side is a promise", () => {
    const memoized: string[] = [];
    const base = ts.getParsedCommandLineOfConfigFile(join(REPO, "tsconfig.base.json"), {}, {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: () => {},
    })!.options;
    const roots = parsed.filter(({ source }) => source.text.includes("??=")).map(({ file }) => file);
    const program = ts.createProgram(roots, { ...base, noEmit: true });
    const checker = program.getTypeChecker();
    const thenable = (type: ts.Type): boolean =>
      type.isUnion() ? type.types.some(thenable) : checker.getPropertyOfType(type, "then") !== undefined;
    for (const file of roots) {
      const source = program.getSourceFile(file)!;
      walk(source, (node) => {
        if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionEqualsToken) return;
        const type = checker.getTypeAtLocation(node.right);
        if (type.flags & ts.TypeFlags.Any) memoized.push(`${at(source, node)} (any: unprovable)`);
        else if (thenable(type)) memoized.push(at(source, node));
      });
    }
    expect(roots.length).toBeGreaterThan(0);
    expect(memoized).toEqual([]);
  }, 60_000);
});

/**
 * **Every Mosaic client class answers `queryError`.** Mosaic's default does nothing — the
 * coordinator logs, and the client keeps its last answer — so a client without one is a blank or
 * stale chart that never says it failed.
 *
 * Cannot prove: that the failure renders well; vgplot's own marks, which are not classes here and
 * which `ChartRoot` answers for; a `new MosaicClient()` used as an identity rather than connected.
 */
describe("every Mosaic client reports a failed query", () => {
  it("bites on a class extending MosaicClient with no queryError", () => {
    const deaf: string[] = [];
    let clients = 0;
    for (const { source } of parsed) {
      walk(source, (node) => {
        if (!ts.isClassDeclaration(node)) return;
        const extended = node.heritageClauses?.some(
          (clause) =>
            clause.token === ts.SyntaxKind.ExtendsKeyword &&
            clause.types.some((type) => type.expression.getText(source) === "MosaicClient"),
        );
        if (!extended) return;
        clients++;
        const answers = node.members.some(
          (member) => ts.isMethodDeclaration(member) && member.name.getText(source) === "queryError",
        );
        if (!answers) deaf.push(at(source, node));
      });
    }
    expect(clients).toBeGreaterThan(0);
    expect(deaf).toEqual([]);
  });
});

/**
 * **A failure reaches a host as the thrown value, never as its message.** A property named
 * `onFailure`, `onError` or `error` typed `string`, or a callback of that name taking one, is where a
 * code, its data and its causes were reduced to prose — and a host can no longer choose what to show.
 *
 * Cannot prove: a failure reaching the host another way — a status string, a rendered sentence.
 */
describe("no failure is a string", () => {
  const NAMES = new Set(["onFailure", "onError", "error"]);
  const stringly = (type: ts.TypeNode | undefined): boolean => {
    if (!type) return false;
    if (type.kind === ts.SyntaxKind.StringKeyword) return true;
    if (ts.isUnionTypeNode(type)) return type.types.some(stringly);
    if (ts.isFunctionTypeNode(type)) return type.parameters.some((parameter) => stringly(parameter.type));
    return false;
  };

  it("bites on onFailure, onError or error typed string", () => {
    const flattened: string[] = [];
    for (const { source } of parsed) {
      walk(source, (node) => {
        if (
          (ts.isPropertySignature(node) || ts.isPropertyDeclaration(node)) &&
          NAMES.has(node.name.getText(source)) &&
          stringly(node.type)
        ) {
          flattened.push(at(source, node));
        }
      });
    }
    expect(flattened).toEqual([]);
  });
});
