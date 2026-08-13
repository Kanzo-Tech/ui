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
 *
 * ## What this guard cannot prove
 *
 * - **It reads the manifest and the source text, not a bundle.** `scripts/smoke-install.mjs` is the
 *   one that asserts the same thing against a real installed tree, and it is the only check that
 *   sees the built artefact. This one runs in milliseconds and is therefore the one that runs.
 * - **A dynamic import is invisible.** `await import(specifier)` with a computed specifier, or a
 *   `require` behind a variable, passes. Every current reference is a literal specifier.
 * - **It cannot tell you the derivation is *fast enough* anywhere.** It only says where it may not
 *   run. The cost itself is measured in `@kanzo-tech/palette`'s own tests.
 * - **`CHART_SLOTS` is counted against the sheet, not against a rendered chart.** Both constants
 *   could agree on a number that no chart honours; what this rules out is the two of them drifting
 *   apart in silence, which is the failure that actually happened.
 */
describe("the palette boundary", () => {
  it("keeps @kanzo-tech/palette out of every dependency field that ships", () => {
    // `dependencies` is the obvious one. A peer or an optional peer reaches a consumer's tree just
    // as surely, and neither was checked — a rule spelled against one field holds for one field.
    const manifest = pkg as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    for (const field of ["dependencies", "peerDependencies", "optionalDependencies"] as const) {
      expect(
        Object.keys(manifest[field] ?? {}),
        `the derivation would reach a browser bundle through ${field} — it must stay a devDependency`,
      ).not.toContain("@kanzo-tech/palette");
    }
    expect(Object.keys(manifest.devDependencies)).toContain("@kanzo-tech/palette");
  });

  it("imports nothing from it outside the tests", () => {
    // The tests may (this file does). Shipped source may not: it is what a bundler follows.
    // A mention in prose is fine and there are several — an import specifier is not.
    const entries = readdirSync(resolve(pkgDir, "src"), { withFileTypes: true });

    // The reader is one level deep, and a `.ts` inside a new subdirectory would be shipped without
    // ever being read. A scan that quietly covers less than it thinks reports the same green.
    expect(
      entries.filter((e) => e.isDirectory()).map((e) => e.name),
      "a nested directory in src/ would be skipped in silence — make the reader recurse",
    ).toEqual([]);

    const shipped = entries
      .filter((e) => e.isFile() && /\.tsx?$/.test(e.name) && !e.name.includes(".test."))
      .map((e) => e.name);

    // The corpus, stated and pinned: a loop over an empty list passes every assertion inside it, so
    // the list is named rather than merely walked. It grew from one file to three when the section
    // mechanism landed, and the two additions are exactly the kind this guard exists to watch:
    //
    //   · `sections.ts` re-declares the binding shape (`{ kind: "alpha", ramp, step }`) structurally
    //     rather than importing `RoleBinding`, which would fail the text match below — and rightly,
    //     because the palette's version carries `SurfaceName` elevation and `RampName`, neither of
    //     which a browser resolving a section token has any use for. Third deliberate
    //     re-declaration, after `CHART_SLOTS` and `SwatchOption`, and the same reasoning.
    //   · `obligations.ts` reads `theme-data.json`, a generated artefact of this package, and
    //     nothing else.
    //
    // Adding a file here is a decision: it widens what a bundler follows. Keep the list explicit so
    // that widening is something somebody reviews.
    expect(shipped.sort(), "the shipped source of this package is exactly this list").toEqual([
      "index.ts",
      "obligations.ts",
      "sections.ts",
    ]);

    for (const file of shipped) {
      const source = read(`src/${file}`);
      expect(
        readFileSync(resolve(pkgDir, "src", file)).includes(0),
        `${file} contains a NUL byte, which makes it binary to grep`,
      ).toBe(false);
      expect(source.trim(), `${file} is empty`).not.toBe("");
      expect(source, file).not.toMatch(
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

/** Why `CHART_SLOTS` is declared twice is on the constant in `./index`. This is what stops it drifting. */
describe("CHART_SLOTS", () => {
  it("matches the number of --chart-N properties the sheet declares", () => {
    const tokens = read("tokens.css");
    const declared = new Set(
      [...tokens.matchAll(/^\s*--chart-(\d+):/gm)].map((m) => Number(m[1])),
    );
    // Stated separately, because `[]` equals `[]` when `CHART_SLOTS` is 0 and a sheet that declares
    // no chart property would then agree with a constant that claims none.
    expect(CHART_SLOTS, "CHART_SLOTS has gone to zero").toBeGreaterThan(0);
    expect(declared.size, "tokens.css declares no --chart-N at all").toBeGreaterThan(0);
    expect([...declared].sort((a, b) => a - b)).toEqual(
      Array.from({ length: CHART_SLOTS }, (_, i) => i + 1),
    );
  });

  it("matches the count the derivation emits", () => {
    expect(CHART_SLOTS).toBe(DERIVED_SLOTS);
  });
});
