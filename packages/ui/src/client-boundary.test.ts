import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The client boundary, as a test rather than as a habit.
 *
 * CONVENTIONS.md: *a file gets `"use client"` **iff** it calls a React hook, registers an event
 * listener, or imports a module that does. Hook-free presentational components must not have it, so
 * they stay server-renderable.* Both halves of that "iff" had failed silently:
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
 */

const SRC = resolve(dirname(fileURLToPath(import.meta.url)));

/**
 * Anything that makes a module stateful, and therefore a client module.
 *
 * **Any** `useX(` call, not a list of React's own: a component calling `useDataTableContext()` or
 * `useChartOptional()` is exactly as much a client component as one calling `useContext()`, and a
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

/**
 * A module needs the directive when **it itself** uses a client feature — not when something it
 * imports does.
 *
 * CONVENTIONS.md phrases the rule as "…or imports a module that does", which is a shade too strong
 * and is why 59 files ended up carrying it for nothing. The boundary is established *once*, by the
 * module with the hook in it, and every importer above that point stays server-renderable and
 * renders it as a client boundary. Ark relies on exactly this — it ships the directive on its own
 * dist files, which is what lets a hook-free wrapper of an Ark machine be a Server Component.
 *
 * The transitive form only bites when a hook-bearing module is *missing* its directive, and the
 * first test below makes that impossible.
 */
const needsDirective = (file: string) => CLIENT_FEATURE.test(text.get(file) as string);

const has = (file: string) => /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(text.get(file) as string);
const name = (file: string) => relative(SRC, file);

describe("the client boundary", () => {
  it("puts the directive on every module that is stateful", () => {
    // The failure this catches is the expensive one: without the directive the module is a Server
    // Component, and a hook inside one throws at render.
    const missing = files.filter((f) => needsDirective(f) && !has(f)).map(name);
    expect(missing).toEqual([]);
  });

  it("keeps the directive off every module that is not", () => {
    // The cheap failure, 59 times over: a presentational wrapper opting out of server rendering for
    // nothing. Delete the line — the boundary is already established by whatever it imports.
    const surplus = files.filter((f) => !needsDirective(f) && has(f)).map(name);
    expect(surplus).toEqual([]);
  });

  it("keeps the pure half of token colour server-reachable", () => {
    // The specific regression: `chart-config.ts` calls `categoricalColor`, and both its callers are
    // public `/analytics` exports. If `lib/token-color.ts` ever becomes a client module again, a
    // Server Component calling `chartSeriesEntries` or `chartSeriesColor` throws.
    for (const file of ["lib/token-color.ts", "charts/chart-config.ts", "charts/chart-spec.ts"]) {
      expect(has(join(SRC, file)), file).toBe(false);
    }
  });
});
