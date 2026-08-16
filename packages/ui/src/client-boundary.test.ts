import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The client boundary, as a test rather than as a habit.
 *
 * CONVENTIONS.md: *a file gets `"use client"` **iff it itself** is stateful — it calls a hook,
 * calls `createContext`, registers a listener, or writes an inline JSX event handler. Importing a
 * stateful module is not a reason. Components that are none of those must not have it, so they stay
 * server-renderable.* `CLIENT_FEATURE` below is that sentence as a regex, and it is the definition
 * this file enforces. Both halves of the "iff" had failed silently:
 *
 * - `composites/SidebarNav.tsx` called `useSidebar()` with no directive. In an RSC graph that
 *   resolves to a client *reference*, so a Server Component rendering it threw.
 * - `charts/theme.ts` mixed two hooks in with six pure functions, which forced the directive onto
 *   the pure half — and `chart-config.ts` *calls* one of those functions from a public
 *   `/analytics` export.
 * - 59 files carried the directive and needed none, each one losing server rendering for nothing.
 *
 * Neither CI nor `pnpm smoke` catches any of that. The CI workflow says so in writing: removing the
 * directive from a thin Ark wrapper does not fail the build, because Ark ships it on its own files
 * and the boundary is already established one level down. And `react-dom/server` outside an RSC
 * bundler ignores the directive entirely, so the smoke test's `renderToString` passes either way.
 *
 * So the invariant is checked here, statically, the way `alpha-steps` and `no-literal-hues` are.
 *
 * ## What this guard cannot prove
 *
 * - **It is a shape match, not an evaluation.** Only the docs RSC build *runs* the boundary; this
 *   asks whether a file looks stateful and whether it says so. `pnpm smoke` compares the bytes of a
 *   built artefact, so it catches Rollup dropping a directive and cannot tell you the boundary is
 *   in the right place. Three different checks, three different claims, and this is the weakest of
 *   them — it is also the only one that runs in under a second.
 * - **Comments are NOT stripped, on purpose.** A docblock quoting `useSidebar()` will make this
 *   guard demand the directive on a file that does not need one. That is the safe direction to be
 *   wrong in: the cost is one file losing server rendering, against a Server Component throwing at
 *   render. Measured across the current corpus, no file's verdict changes either way.
 * - **It cannot see a hook reached through a value.** `const h = useSidebar; h()`, a hook behind an
 *   indirection, or a listener registered by a library on our behalf all read as pure here.
 * - **The transitive half of the CONVENTIONS.md sentence is not enforced, and must not be** — see
 *   the note on `needsDirective`. It is safe only because the first assertion below makes a
 *   hook-bearing module without a directive impossible.
 * - **It says nothing about `/editor`, `/table` and `/analytics` isolation**, which is
 *   `index.test.ts`'s claim, nor about whether a client module is *worth* being one.
 */

const SRC = resolve(dirname(fileURLToPath(import.meta.url)));

/**
 * Anything that makes a module stateful, and therefore a client module.
 *
 * **Any** `useX(` call, not a list of React's own: a component calling `useDataTableContext()` or
 * `useChartContextOptional()` is exactly as much a client component as one calling `useContext()`, and a
 * fixed list of built-ins misses every custom hook in the repo. The `use[A-Z]` shape is the same
 * signal `eslint-plugin-react-hooks` runs on, so a hook this misses is a hook the linter misses too.
 * A declaration (`export function useX(`) is caught as well, which is correct — it is a hook.
 *
 * **A JSX event handler counts, and missing it broke the docs build.** `onClick={…}` on a part is a
 * function prop, and a Server Component may not pass one to a Client Component — React refuses to
 * serialise it. `input-group.tsx` lost its directive while holding an inline `onClick`, and the
 * failure surfaced three layers away, prerendering `/docs/forms/password-input`, with no hook
 * anywhere in the trace. `tsc` cannot see it either. Six files had this shape.
 */
const CLIENT_FEATURE =
  /\buse[A-Z]\w*\s*[(<]|\bcreateContext\s*[(<]|\.addEventListener\s*\(|\son[A-Z]\w*=\{/;

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

const files = sources(SRC);
const text = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));

/** Every directory under `src/`, named so the walk cannot quietly stop descending. */
const LAYERS = ["charts", "composites", "layouts", "lib", "simples", "table", "theme"];

/**
 * A module needs the directive when **it itself** uses a client feature — not when something it
 * imports does.
 *
 * The rule used to be phrased "…or imports a module that does", which is a shade too strong and is
 * why 59 files ended up carrying it for nothing. That phrasing is gone from CONVENTIONS.md and from
 * the docs, and this is the note that says why. The boundary is established *once*, by the
 * module with the hook in it, and every importer above that point stays server-renderable and
 * renders it as a client boundary. Ark relies on exactly this — it ships the directive on its own
 * dist files, which is what lets a hook-free wrapper of an Ark machine be a Server Component.
 *
 * The transitive form only bites when a hook-bearing module is *missing* its directive, and the
 * first test below makes that impossible.
 */
const read = (file: string) => {
  const source = text.get(file);
  // Without this, a renamed or deleted file reads as the string "undefined", matches nothing, and
  // every assertion about it passes. That is how a guard survives the disappearance of its subject.
  if (source === undefined) throw new Error(`${relative(SRC, file)} is not in the scanned corpus`);
  return source;
};

const needsDirective = (file: string) => CLIENT_FEATURE.test(read(file));

const has = (file: string) =>
  /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(read(file));

const name = (file: string) => relative(SRC, file);

describe("the client boundary", () => {
  it("reads every source file under src/, in every layer", () => {
    // A walk that finds nothing reports the same green as a real pass — and both assertions below
    // are `toEqual([])`, which is exactly what an empty corpus produces. 100 is a floor, not a count.
    expect(files.length, "the walk found almost nothing — it is not reaching src/").toBeGreaterThan(
      100,
    );
    for (const layer of LAYERS) {
      expect(
        files.filter((f) => name(f).startsWith(`${layer}/`)).length,
        `${layer}/ contributed no file to the scan`,
      ).toBeGreaterThan(0);
    }

    // A NUL byte makes `file(1)` and every `grep -I` treat a source file as binary and skip it in
    // silence; `charts/chart-inputs.tsx` held one. `readFileSync(…, "utf8")` reads it regardless,
    // so this scan never had that hole — but the next reader will reach for grep first.
    const binary = files.filter((f) => readFileSync(f).includes(0)).map(name);
    expect(binary, "a NUL byte makes this file invisible to grep — strip it").toEqual([]);

    const empty = files.filter((f) => read(f).trim() === "").map(name);
    expect(empty, "an empty source file is a scan that proves nothing").toEqual([]);
  });

  it("puts the directive on every module that is stateful", () => {
    // The failure this catches is the expensive one: without the directive the module is a Server
    // Component, and a hook inside one throws at render.
    const missing = files.filter((f) => needsDirective(f) && !has(f)).map(name);
    expect(
      missing,
      `These modules use a hook, a listener or a JSX handler and do not say so. In an RSC graph\n` +
        `each is a Server Component, and the failure surfaces wherever it is rendered — add\n` +
        `"use client" as the first statement:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("keeps the directive off every module that is not", () => {
    // The cheap failure, 59 times over: a presentational wrapper opting out of server rendering for
    // nothing. Delete the line — the boundary is already established by whatever it imports.
    const surplus = files.filter((f) => !needsDirective(f) && has(f)).map(name);
    expect(
      surplus,
      `These modules carry the directive and use no client feature, so each is opting out of server\n` +
        `rendering for nothing. Delete the line — whatever they import establishes the boundary:\n` +
        surplus.join("\n"),
    ).toEqual([]);
  });

  it("keeps the pure half of token colour server-reachable", () => {
    // The specific regression: `chart-config.ts` calls `categoricalColor`, and both its callers are
    // public `/analytics` exports. If `lib/token-color.ts` ever becomes a client module again, a
    // Server Component calling `chartSeriesEntries` or `chartSeriesColor` throws.
    for (const file of ["lib/token-color.ts", "charts/chart-config.ts", "charts/chart-spec.ts"]) {
      // Named, so a rename cannot turn this into three assertions about nothing. `read` throws on
      // a file outside the corpus for the same reason — a missing file used to read as "undefined",
      // match no directive, and pass.
      expect(existsSync(join(SRC, file)), `${file} has moved — this test names it`).toBe(true);
      expect(has(join(SRC, file)), file).toBe(false);
    }
  });

  it("recognises each shape of client feature, and no server-safe one", () => {
    // Four alternations, each of which was added because it had already been missed once.
    for (const stateful of [
      "const [x, set] = useState(0);",
      "const ctx = useSidebar();",
      "export function useThing() {",
      "const v = useMemo<string>(() => x, []);",
      "const C = createContext(null);",
      "const C = createContext<Thing | null>(null);",
      "window.addEventListener('resize', onResize);",
      "<button onClick={handle} />",
      "<Item onValueChange={next} />",
    ]) {
      expect(CLIENT_FEATURE.test(stateful), `${stateful} is a client feature and was missed`).toBe(
        true,
      );
    }

    for (const pure of [
      "const x = useful(1);", // lowercase after `use` — not a hook
      "export const user = { name };",
      "const onclick = 1;", // no capital, not a JSX attribute
      "const props = { onClick: handle };", // an object literal, not JSX — the callee's problem
      "element.removeEventListener('resize', onResize);",
      "<div className={cn('a')} />",
    ]) {
      expect(CLIENT_FEATURE.test(pure), `${pure} is server-safe and was caught`).toBe(false);
    }
  });
});
