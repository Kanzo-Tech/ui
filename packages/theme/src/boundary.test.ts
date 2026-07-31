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
 * costs 0.2–7.4 s. The runtime only applies a stored document. That is a promise anyone can break
 * by accident, so it is not left to a reviewer to remember: `@kanzo-tech/palette` is a
 * devDependency, and a `dependencies` entry appearing later fails here.
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

/**
 * `SwatchOption` is the second deliberate re-declaration, and the reason is the import guard
 * above: it is a text match, so `import type { Identity } from "@kanzo-tech/palette"` fails it too.
 * That is the right outcome rather than a limitation — the document's `Identity` carries `brand`,
 * `ramp`, `categorical` and `record`, and a browser has no use for any of them. What the runtime
 * needs is the narrowing, and a narrowing that quietly grows back toward its source is a narrowing
 * that has stopped being one.
 */
describe("SwatchOption", () => {
  const src = read("src/index.ts");

  it("is declared here, not re-exported from the derivation", () => {
    expect(src).toMatch(/export interface SwatchOption \{/);
  });

  it("carries only what a browser can use", () => {
    // `children` is the fourth and it is not a widening: it is the same narrowed shape one level
    // down, which is how a brand inside a document is expressed. What must stay out are the
    // document's own fields — a seed, a ramp, a categorical set, a record — and the assertion is by
    // name so adding any of them fails here rather than in whatever bundles it.
    const body = src.match(/export interface SwatchOption \{([^}]*)\}/s)?.[1] ?? "";
    const fields = [...body.matchAll(/^\s*(\w+)[?]?:/gm)].map((m) => m[1]);
    expect(fields.sort()).toEqual(["children", "label", "swatches", "value"]);
  });
});

/**
 * `CHART_SLOTS` is declared twice on purpose — here, because a chart in a browser needs it and
 * cannot reach the derivation, and in `@kanzo-tech/palette`, because that is what emits the
 * properties. Neither copy is trusted: both are held against the sheet they describe.
 */
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
