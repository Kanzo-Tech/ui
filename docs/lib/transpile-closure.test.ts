import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `transpilePackages` must be CLOSED over our own packages, and nothing else checks that.
 *
 * The list is hand-written, and adding a package to the workspace does not touch it. That is
 * survivable while the list is a leaf; it stops being survivable the moment a transpiled package
 * imports another of ours. Next compiles `@kanzo-tech/ui` from source here — that is the whole
 * point of this app, it is the only place the real client/server boundary is exercised — and a
 * source it compiles may import `@kanzo-tech/mosaic`, which it then must be allowed to compile too.
 *
 * It failed exactly that way once: extracting the Mosaic data layer out of `ui` into its own
 * package left the list naming ui and theme, and `next build` died before rendering a page with
 * `TypeError: Cannot read properties of undefined (reading 'length')` and a stack of ignore-listed
 * frames. Nothing in that message names a package, a config key, or a file. The build is the only
 * thing that catches it and it catches it unreadably, which is what this test is for.
 *
 * The rule is one line: if a package is transpiled, every `@kanzo-tech/*` it depends on is too.
 * Deliberately NOT "every workspace package must be listed" — `@kanzo-tech/graph` and
 * `@kanzo-tech/ai` are dependencies of this app and are correctly absent, because this app consumes
 * their published build rather than their source.
 */
const repoRoot = join(import.meta.dirname, "..", "..");

const SCOPE = "@kanzo-tech/";

function transpiled(): string[] {
  const config = readFileSync(join(repoRoot, "docs", "next.config.ts"), "utf8");
  const match = /transpilePackages:\s*\[([^\]]*)\]/.exec(config);
  if (!match) throw new Error("next.config.ts no longer declares transpilePackages — did it move?");
  return [...match[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
}

function ourDependenciesOf(pkg: string): string[] {
  const dir = pkg.slice(SCOPE.length);
  const manifest = JSON.parse(
    readFileSync(join(repoRoot, "packages", dir, "package.json"), "utf8"),
  ) as { dependencies?: Record<string, string> };
  return Object.keys(manifest.dependencies ?? {}).filter((d) => d.startsWith(SCOPE));
}

describe("transpilePackages", () => {
  it("names only packages that exist in the workspace", () => {
    for (const pkg of transpiled().filter((p) => p.startsWith(SCOPE))) {
      expect(() => ourDependenciesOf(pkg), `${pkg} is transpiled but has no packages/ directory`).not.toThrow();
    }
  });

  it("is closed: a transpiled package's own @kanzo-tech dependencies are transpiled too", () => {
    const list = transpiled();
    const missing: string[] = [];
    for (const pkg of list.filter((p) => p.startsWith(SCOPE))) {
      for (const dep of ourDependenciesOf(pkg)) {
        if (!list.includes(dep)) missing.push(`${dep} (imported by ${pkg})`);
      }
    }
    expect(missing, "add these to transpilePackages in docs/next.config.ts").toEqual([]);
  });
});
