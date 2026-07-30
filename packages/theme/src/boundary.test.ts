import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CHART_SLOTS as DERIVED_SLOTS } from "@kanzo-tech/palette";
import { CHART_SLOTS } from "./index";
import pkg from "../package.json";

const pkgDir = resolve(__dirname, "..");
const read = (f: string) => readFileSync(resolve(pkgDir, f), "utf8");

/**
 * The one structural promise this package makes: **derivation is not on the runtime path.**
 *
 * A tenant document is derived and measured once, at onboarding — the categorical search alone
 * costs seconds, measured at `WHEEL_SPOKES` in `@kanzo-tech/palette`'s `derive-palette.ts`. The
 * runtime only applies a stored document. That is a promise anyone can break by accident, so it is
 * not left to a reviewer to remember: `@kanzo-tech/palette` is a devDependency, and a
 * `dependencies` entry appearing later fails here.
 */
describe("the palette boundary", () => {
  it("keeps @kanzo-tech/palette out of dependencies", () => {
    const deps = { ...(pkg as { dependencies?: Record<string, string> }).dependencies };
    expect(
      Object.keys(deps),
      "the derivation would reach a browser bundle — it must stay a devDependency",
    ).not.toContain("@kanzo-tech/palette");
    expect(Object.keys(pkg.devDependencies)).toContain("@kanzo-tech/palette");
  });

  it("imports nothing from it outside the tests", () => {
    // The tests may (this file does). Shipped source may not: it is what a bundler follows.
    // A mention in prose is fine and there are several — an import specifier is not.
    const shipped = readdirSync(resolve(pkgDir, "src")).filter((f) => !f.includes(".test."));
    for (const file of shipped) {
      expect(read(`src/${file}`), file).not.toMatch(
        /(?:from|import|require)\s*\(?\s*["']@kanzo-tech\/palette/,
      );
    }
  });
});

/** Why `CHART_SLOTS` is declared twice is on the constant in `./index`. This is what stops it drifting. */
describe("CHART_SLOTS", () => {
  it("matches the number of --chart-N properties the sheet declares", () => {
    const tokens = read("tokens.css");
    const declared = new Set(
      [...tokens.matchAll(/^\s*--chart-(\d+):/gm)].map((m) => Number(m[1])),
    );
    expect([...declared].sort((a, b) => a - b)).toEqual(
      Array.from({ length: CHART_SLOTS }, (_, i) => i + 1),
    );
  });

  it("matches the count the derivation emits", () => {
    expect(CHART_SLOTS).toBe(DERIVED_SLOTS);
  });
});
