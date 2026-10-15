import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * **A name means one thing across every entry, and shadows none of the language's.** `Table` was
 * the root's component and, through `/table`, TanStack's instance type; `Problem` was a component
 * and the theme's section-validation record; `Selection` was Mosaic's class and the graph's picked
 * vertices; `Pick` shadowed TypeScript's `Pick<T, K>` in any file that imported it. Each import of
 * both had to rename one — the collision announcing itself — and `/docs/design/naming` settles
 * them the one way: the reference's name stays, ours moves.
 *
 * **The source of truth is the built surface, not `src`.** `docs/` resolves `@kanzo-tech/ui` to
 * `dist/`, so the export set is read out of the emitted `.d.ts` for the root barrel and every
 * subpath in each package's own `exports` map, by the TypeScript checker rather than by a regex over
 * the file. It says so when there is no `dist/` (`UNBUILT`, `BUILD_FIRST`).
 *
 * **What this cannot prove:**
 * - A name of ours that collides with a peer's we do not re-export (Ark's `Dialog` is Ark's, and
 *   ours is its wrapper on purpose).
 * - Two names that mean one thing — that is a duplicate, which no reading of declarations tells from
 *   a coincidence.
 * - That a name stays on the barrel. Nothing here maps exports to anything, so a name of ours alone
 *   can leave without this going red; `index.test.ts` enumerates by hand what it asserts, and
 *   `shark-parity.test.ts` holds the half of the surface Shark also ships.
 */

const SRC = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(SRC, "../../..");

const COMPILER: ts.CompilerOptions = {
  noEmit: true,
  skipLibCheck: true,
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
};

/**
 * Every entry point, read out of the package manifests rather than listed here. Adding a subpath to
 * `exports` extends this guard's reach for free; a hand-written list goes stale the day someone adds
 * `/graph`. `mosaic` is in it because its names are what `/analytics` and the graph speak in —
 * `Selection` is Mosaic's class — so a name of ours that means something else collides with it.
 */
type Entry = { spec: string; types: string };

function entryPoints(pkgDir: string): Entry[] {
  const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")) as {
    name: string;
    exports?: Record<string, unknown>;
  };
  const found: Entry[] = [];
  for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
    const types = (target as { types?: unknown } | null)?.types;
    if (typeof types !== "string" || !types.endsWith(".d.ts")) continue;
    found.push({ spec: pkg.name + subpath.slice(1), types: join(pkgDir, types) });
  }
  return found;
}

const ENTRIES = ["ui", "theme", "mosaic", "graph", "ai", "llm", "auth", "navigation", "testing"].flatMap((name) =>
  entryPoints(join(REPO, "packages", name)),
);

const UNBUILT = ENTRIES.filter((e) => !existsSync(e.types)).map((e) => e.spec);
const BUILD_FIRST =
  "run `pnpm build` first: this guard reads dist/, the way docs/ does, and there is no dist/ here";

type Surface = {
  /** Each name any entry exports, and every declaration it resolves to, by entry. */
  meanings: Map<string, Map<string, string>>;
  /** Every type and value TypeScript's own `lib` declares globally — `Pick`, `Partial`, `Record`. */
  language: Set<string>;
};

let cached: Surface | null = null;

function surface(): Surface {
  if (cached) return cached;

  const program = ts.createProgram(
    ENTRIES.map((e) => e.types),
    COMPILER,
  );
  const checker = program.getTypeChecker();

  // Where a name comes from, as the file and offset of its first declaration once every re-export is
  // followed: two entries that pass one symbol through agree, two that declare their own do not.
  const meanings = new Map<string, Map<string, string>>();
  for (const entry of ENTRIES) {
    const source = program.getSourceFile(entry.types);
    const symbol = source && checker.getSymbolAtLocation(source);
    // Not an assertion failure but a broken premise: a module with no symbol contributed nothing,
    // and every name it exports would read as unique rather than as a miss.
    if (!symbol) throw new Error(`no module symbol for ${entry.types} — is the build stale?`);
    for (const exported of checker.getExportsOfModule(symbol)) {
      const target = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
      const declaration = target.declarations?.[0];
      if (!declaration) continue;
      const where = `${relative(REPO, declaration.getSourceFile().fileName)}:${declaration.pos}`;
      const byEntry = meanings.get(exported.getName()) ?? new Map<string, string>();
      byEntry.set(entry.spec, where);
      meanings.set(exported.getName(), byEntry);
    }
  }
  // The language's own names, from the default `lib` files and not the DOM's: `Selection` and
  // `Range` are the DOM's and Mosaic's both, which is the reference's business, not ours.
  const anyFile = program.getSourceFile(ENTRIES[0]!.types)!;
  const language = new Set(
    checker
      .getSymbolsInScope(anyFile, ts.SymbolFlags.Type | ts.SymbolFlags.Value)
      .filter((symbol) =>
        symbol.declarations?.some((d) => {
          const file = d.getSourceFile();
          return program.isSourceFileDefaultLibrary(file) && !/dom/i.test(file.fileName);
        }),
      )
      .map((symbol) => symbol.getName()),
  );

  cached = { meanings, language };
  return cached;
}

describe("one meaning", () => {
  // Resolving nine packages' entry points through the checker costs a few seconds, once. It happens
  // here so the assertion does not pay it and trip the default test timeout.
  beforeAll(() => {
    if (UNBUILT.length === 0) surface();
  }, 120_000);

  /**
   * Collisions this guard found the day it was written, 13 October 2026, beyond the four the review
   * had found and settled. Each is put to the owner rather than renamed in the commit that built the
   * instrument: which side moves is a decision. The list may only shrink.
   */
  const UNSETTLED: Record<string, string> = {
    Finding: "`@kanzo-tech/ui`'s finding of a check, and `/task`'s oracle finding — a diagnostic or a decision",
    Diagnostic: "`@kanzo-tech/ui`'s component, and `/task`'s oracle diagnostic, LSP's shape",
    Link: "`@kanzo-tech/ui`'s styled anchor, and `@kanzo-tech/navigation/next`'s guarded `next/link`",
    Tool: "`@kanzo-tech/graph`'s canvas tool, `@kanzo-tech/ai`'s tool-call part, and the AI SDK's `Tool` that `@kanzo-tech/llm` re-exports",
  };

  it("gives each name one meaning across every entry, and shadows none of the language's", () => {
    expect(UNBUILT, BUILD_FIRST).toEqual([]);
    const { meanings, language } = surface();
    const twice = [...meanings]
      .filter(([, byEntry]) => new Set(byEntry.values()).size > 1)
      .map(([name, byEntry]) => ({ name, entries: [...byEntry.keys()].sort() }));
    const unsettled = twice.filter(({ name }) => !(name in UNSETTLED));
    expect(
      unsettled.map(({ name, entries }) => `${name}: ${entries.join(", ")}`),
      "one name, two meanings — rename ours, the way /docs/design/naming settles each",
    ).toEqual([]);
    // A pinned collision that has been settled must leave the list with the rename.
    expect(Object.keys(UNSETTLED).filter((name) => !twice.some((t) => t.name === name))).toEqual([]);
    expect(language.has("Pick") && language.has("Partial"), "the language's names must resolve").toBe(true);
    const shadowing = [...meanings.keys()].filter((name) => language.has(name));
    expect(shadowing, "a name the language already gives").toEqual([]);
  });
});
