import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The studio may not carry a colour of its own.
 *
 * It did, for a day: thirty-odd hex literals under a comment calling them "the same ones
 * `themes/kanzo.css` ships". Five were not — `--card`, `--muted`, `--muted-foreground`, `--accent`
 * and `--ring` — so the page that exists to author a theme opened on a theme that does not exist.
 * Nothing could catch it. A copy is only wrong relative to its original, and the file asserting
 * they matched was the copy.
 *
 * The fix was to stop having one: values come off the cascade now, through `readTheme`. This keeps
 * it that way, and it is deliberately blunt — any six-digit hex at all, not just a chromatic one.
 * The seed that drifted was greys.
 *
 * ## What this cannot prove
 *
 * - **That `readTheme` reads the right thing.** It asserts an absence. A `readTheme` that returned
 *   an empty object would pass here and the generator would open blank, which is the kind of failure
 *   the browser catches and a string search never will.
 * - **Anything about the showcases.** A demo that draws a chart legend in fixed colours is a
 *   different question with a different answer, and `no-literal-hues.test.ts` is where the
 *   repository-wide version of it lives.
 */
describe("the theme generator", () => {
  // Both files of the route, because the rule is about the SURFACE and not about one module. The
  // preview moved into `theme-sampler.tsx` when it stopped being a mock screen, and a guard that
  // kept reading only the form would have let a literal in through the pane it is aimed at.
  const source = ["theme-generator.tsx", "theme-sampler.tsx"]
    .map((file) => readFileSync(join(__dirname, file), "utf8"))
    .join("\n");

  it("holds no colour literal", () => {
    const hex = [...source.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0]);
    expect(hex).toEqual([]);
  });

  it("reads its starting values from the stylesheet, and its catalogue from the generator", () => {
    // The absence above is only half the rule: a file with no hex and no `readTheme` is a studio
    // that seeds from nothing. Both halves, so neither can be satisfied by deleting the other.
    expect(source).toMatch(/function readTheme\(/);
    // `themeIndex`, however it is walked. This asserted `themeIndex.map(` and broke the day the
    // "Start from" control grouped its options by side — `themeIndex.filter(…).map(…)` — which is
    // the same catalogue read the same way. What the rule is about is that the list is not typed
    // here, and a matcher pinned to one call shape was testing the spelling instead.
    expect(source).toMatch(/\bthemeIndex\b/);
    // And the fallback chain comes from the generated table rather than a copy of `tokens.css`.
    expect(source).toMatch(/themeData\.fallbacks/);
  });
});
