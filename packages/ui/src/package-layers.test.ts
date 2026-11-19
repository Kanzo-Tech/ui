import { readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { label, REPO, SHIPPED, sourceFiles, type Root } from "./guard-corpus";

/**
 * Imports point down: between the packages, by the layer table on `/docs/design/architecture`, and
 * inside the two packages whose design pages draw layers of their own.
 *
 * **The table is read off the page, not copied here.** Each row of *Five layers, imports point down*
 * names its members in backticks — a package, or an entry such as `@kanzo-tech/mosaic/engine` — and
 * the sentence under it names the sibling edges, `` `ai/data` reads `ui/analytics` ``. An edit to the
 * page is an edit to this guard. Over it, the narrower rule `/docs/philosophy` states for `ui`, read
 * off that page the same way: `ui` imports none of the packages it names.
 *
 * A module's layer is its entry's when the table names one — `ui/analytics`, `mosaic/engine` — and its
 * package's otherwise; `ui`'s charts are `/analytics` behind a directory of another name, so they are
 * held to the root's layer, which is the stricter reading. Inside a package the bands are below, each
 * argued on its page: a module imports from its own band or one below it.
 *
 * ## What this cannot prove
 *
 * - **It reads source, not `dist/`.** A bundler that inlined a sibling would not be seen; the builds
 *   externalise every `@kanzo-tech/*` package.
 * - **It reads declarations and `import()` calls with a literal specifier.** A `require`, or a
 *   specifier computed at runtime, is not seen. `import type` is read, because a type names the
 *   direction as much as a value does.
 * - **It cannot see an entry the page does not name.** A new entry is held to its package's layer
 *   until the table gives it one.
 * - **Tests are not walked**, and a module under `testing` — the `./testing` entry, or a directory of
 *   that name — may import what is outside the map, as the page allows.
 */

const ARCHITECTURE = readFileSync(join(REPO, "docs/content/docs/design/architecture.mdx"), "utf8");
const PHILOSOPHY = readFileSync(join(REPO, "docs/content/docs/(root)/philosophy.mdx"), "utf8");

const ticks = (text: string) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]!);
const bare = (name: string) => name.replace(/^@kanzo-tech\//, "");

/** Entry or package → layer, from the rows of the table. `/table` after `ui` is `ui/table`. */
const LAYER = new Map<string, number>();
const section = ARCHITECTURE.split("## Five layers, imports point down")[1]?.split("\n## ")[0] ?? "";
for (const [, layer, holds] of section.matchAll(/^\| \*\*L(\d)\*\* \| (.+?) \|/gm)) {
  let owner = "";
  for (const name of ticks(holds!)) {
    if (name.includes("*")) continue;
    const key = name.startsWith("/") ? `${owner}${name}` : bare(name);
    if (!name.startsWith("/")) owner = key.split("/")[0]!;
    LAYER.set(key, Number(layer));
  }
}

const EDGES = [...(/a sibling edge exists\s+only where this table names it: ([^.]+)\./.exec(section)?.[1] ?? "").matchAll(/`([^`]+)` reads `([^`]+)`/g)].map(
  ([, from, to]) => ({ from: from!, to: to! }),
);

const OUTSIDE = new Set([...section.matchAll(/`@kanzo-tech\/([a-z-]+)` is\s+outside\s+the map/g)].map((m) => m[1]!));

const UI_NEVER = ticks(/It imports none of\s+([\s\S]*?), and none of them/.exec(PHILOSOPHY)?.[1] ?? "");

/**
 * The bands inside a package, bottom first. `graph`'s are `/docs/design/graph`'s *The layers*, with
 * `section.ts` beside `render/`, whose builders parse it. `ui`'s are `/docs/philosophy`'s *The three
 * layers* — a composite is an assembly of simples, a layout positions them — over `lib/`, and `theme/`
 * under that, the appearance plane `lib/` reads. A top-level module no band names is an entry, and a
 * band reaches no entry.
 */
const BANDS: Record<string, readonly (readonly string[])[]> = {
  graph: [["core"], ["render", "section"], ["react"], ["parts"]],
  ui: [["theme"], ["lib"], ["simples"], ["composites", "layouts", "charts", "table"]],
};

interface Import {
  readonly spec: string;
  readonly file: string;
}

function importsOf(file: string): Import[] {
  const out: Import[] = [];
  const visit = (node: ts.Node): void => {
    const declaration = ts.isImportDeclaration(node) || ts.isExportDeclaration(node);
    if (declaration && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) out.push({ spec: node.moduleSpecifier.text, file });
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [arg] = node.arguments;
      if (arg && ts.isStringLiteralLike(arg)) out.push({ spec: arg.text, file });
    }
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX));
  return out;
}

/** The first path segment under `src/`, without its extension: `charts`, `engine`, `index`. */
const segment = (root: Root, file: string) => relative(root.src, file).split(sep)[0]!.replace(/\.tsx?$/, "");
const underTesting = (root: Root, file: string) => relative(root.src, file).split(sep).some((part) => part.replace(/\.tsx?$/, "") === "testing");

const manifestOf = (root: Root) =>
  JSON.parse(readFileSync(join(dirname(root.src), "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
const declared = (root: Root) =>
  [...Object.keys(manifestOf(root).dependencies ?? {}), ...Object.keys(manifestOf(root).peerDependencies ?? {})]
    .filter((name) => name.startsWith("@kanzo-tech/"))
    .map(bare);

const MAPPED = SHIPPED.filter((root) => !OUTSIDE.has(root.name));
const siblings = MAPPED.flatMap((root) =>
  sourceFiles(/\.tsx?$/, [root]).flatMap((file) =>
    importsOf(file)
      .filter(({ spec }) => spec.startsWith("@kanzo-tech/"))
      .map(({ spec }) => ({ root, file, target: bare(spec) }))
      .filter(({ target }) => target.split("/")[0] !== root.name),
  ),
);

const layerOf = (key: string) => LAYER.get(key) ?? LAYER.get(key.split("/")[0]!);
const packageLayers = (name: string) => [...LAYER].filter(([key]) => key.split("/")[0] === name).map(([, layer]) => layer);

describe("package layers", () => {
  it("reads a table, its sibling edges and ui's exclusions off the pages", () => {
    expect([...new Set([...LAYER.values()])].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(EDGES.length).toBeGreaterThan(0);
    expect(OUTSIDE.has("testing")).toBe(true);
    expect(UI_NEVER).toEqual(expect.arrayContaining(["graph", "ai"]));
    expect(MAPPED.filter((root) => layerOf(root.name) === undefined).map((root) => root.name), "a shipped package with no layer").toEqual([]);
    expect(siblings.length, "the walk found the imports between packages").toBeGreaterThan(50);
  });

  it("imports only from a lower layer or a named sibling edge", () => {
    const offenders: string[] = [];
    for (const { root, file, target } of siblings) {
      const at = label(file);
      const pkg = target.split("/")[0]!;
      if (OUTSIDE.has(pkg) || !MAPPED.some((r) => r.name === pkg)) {
        if (!underTesting(root, file)) offenders.push(`${at}: imports @kanzo-tech/${target}, outside the map, from production code`);
        continue;
      }
      const from = [`${root.name}/${segment(root, file)}`, root.name];
      const own = layerOf(from[0]!)!;
      const theirs = layerOf(target)!;
      const edge = EDGES.some((e) => from.includes(e.from) && (e.to === target || e.to === pkg));
      if (theirs >= own && !edge) offenders.push(`${at}: L${own} imports @kanzo-tech/${target}, at L${theirs}`);
    }
    expect(offenders).toEqual([]);
  });

  it("declares in each manifest only siblings of a lower layer or a named edge, and every sibling its source imports", () => {
    const offenders: string[] = [];
    for (const root of MAPPED) {
      const names = declared(root);
      const top = Math.max(...packageLayers(root.name));
      for (const name of names) {
        if (name === root.name || OUTSIDE.has(name)) continue;
        const edge = EDGES.some((e) => e.from.split("/")[0] === root.name && e.to.split("/")[0] === name);
        if (Math.min(...packageLayers(name)) >= top && !edge) offenders.push(`${root.name}: declares @kanzo-tech/${name}, which is not below it`);
      }
      for (const { file, target } of siblings.filter((s) => s.root === root && !underTesting(root, s.file))) {
        const pkg = target.split("/")[0]!;
        if (!names.includes(pkg)) offenders.push(`${label(file)}: imports @kanzo-tech/${target}, which ${root.name}'s package.json does not declare`);
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });

  it("keeps ui off every package philosophy names", () => {
    const ui = MAPPED.find((root) => root.name === "ui")!;
    const imported = siblings.filter((s) => s.root === ui && UI_NEVER.includes(s.target.split("/")[0]!)).map((s) => `${label(s.file)}: ${s.target}`);
    const listed = declared(ui).filter((name) => UI_NEVER.includes(name));
    expect([...imported, ...listed]).toEqual([]);
  });

  it("imports from a package's own band or one below it", () => {
    const offenders: string[] = [];
    let downward = 0;
    for (const [name, bands] of Object.entries(BANDS)) {
      const root = SHIPPED.find((r) => r.name === name);
      expect(root, `${name} is not shipped`).toBeDefined();
      const band = (part: string) => bands.findIndex((members) => members.includes(part));
      for (const member of bands.flat()) {
        expect(sourceFiles(/\.tsx?$/, [root!]).some((file) => segment(root!, file) === member), `${name}/${member} holds no module`).toBe(true);
      }
      for (const file of sourceFiles(/\.tsx?$/, [root!])) {
        const own = band(segment(root!, file));
        if (own < 0) continue;
        for (const { spec } of importsOf(file)) {
          if (!spec.startsWith(".")) continue;
          const target = relative(root!.src, join(dirname(file), spec)).split(sep)[0]!.replace(/\.(js|tsx?)$/, "");
          const theirs = band(target);
          if (theirs > own) offenders.push(`${label(file)}: imports ${spec}, a band above its own`);
          else if (theirs < 0) offenders.push(`${label(file)}: imports ${spec}, an entry`);
          else if (theirs < own) downward++;
        }
      }
    }
    expect(offenders, "`import type` included").toEqual([]);
    expect(downward, "the walk resolved the relative imports").toBeGreaterThan(200);
  });
});
