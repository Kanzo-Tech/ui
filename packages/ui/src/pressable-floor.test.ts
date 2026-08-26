import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import themeData from "@kanzo-tech/theme/theme-data.json" with { type: "json" };
import { label, sourceFiles } from "./guard-corpus";

/**
 * A pressable size variant may not sit under 24 CSS pixels at the tightest density.
 *
 * WCAG 2.5.8 states its bar as 24×24 **CSS pixels**. Every size in this library is a `rem` against a
 * root the density axis sets, so a variant written `h-6` is 24px at the default root and **21px at
 * compact** — the same number failing or passing depending on a preference the component never sees.
 *
 * Two variants were exactly that: `Button`'s `xs` and `InputGroupButton`'s `xs`, the second of them
 * a `defaultVariants` entry, so an input group that specified nothing got the failing size. Both are
 * deleted. This test was run against the tree before the deletion and reported all four entries
 * (`xs` and `icon-xs` in each), and nothing else — which is the only reason to believe it bites.
 *
 * ## What it looks at, and why the corpus is drawn this narrowly
 *
 * Only the `size: { … }` variant object of a `tv()` recipe, and only in a file that renders a
 * button. A first draft scanned every class string in such a file and produced six findings, all of
 * them false: `[&_svg]:size-4` on an icon, `min-h-0` on a scroll container, `h-5` on a badge. **A
 * class string does not say what element wears it**, and a guard that cries about icons is one
 * people learn to skip. A named size variant of a button recipe is the one place the intent is
 * unambiguous — and it is where both real defects lived.
 *
 * The compact root comes from `theme-data.json` rather than a literal, so the day the density scale
 * moves this moves with it. The `0.25rem` is Tailwind's `--spacing`, checked in a browser against
 * the running docs: `h-6` computes 24 / 21 / 27px and `h-7` 28 / 24.5 / 31.5 across the three
 * densities, which is `1.5rem` and `1.75rem` exactly.
 *
 * ## What this cannot prove
 *
 * - **It cannot see a target with no size variant at all.** A hand-rolled row — a `<button>` with
 *   `px-1 py-0.5` in a showcase — has no recipe and no `size` key, and that is precisely how the
 *   defect that prompted all of this got written. Only the written rule covers that case, and
 *   nothing enforces it.
 * - **It cannot see width.** A target is 24×24; this reads the height axis, because that is the one
 *   these variants name. A `size-N` entry covers both and is checked once.
 * - **It says nothing about the spacing exception.** 2.5.8 forgives an undersized target with
 *   enough clearance around it, and every measured `xs` call site was in fact saved by it. This
 *   guard is about the variant, not the call site: a size whose *name* promises what it cannot
 *   deliver at one density is the defect, whether or not a given arrangement rescues it.
 * - **It trusts the `pointer-coarse` area not to count.** `InputGroupButton` carries a 44px
 *   `::after` for coarse pointers; it is not in the hit path for a mouse, so it does not lift the
 *   figure. If that reading is wrong, this test is too strict rather than too loose.
 * - **The corpus is `ui` and `ai`, derived by `guard-corpus.ts`**, and it was `packages/ui/src`
 *   alone until 2026-08-20. Widening it added `@kanzo-tech/ai`, which contributed **no recipe at
 *   all** to `recipesRead`: measured over its twelve modules, the files that render a button
 *   (`ai-mark.tsx`, `complete.tsx`, `prompt-input.tsx`, `suggest.tsx`) each pass a `size` to one of
 *   `ui`'s recipes rather than declaring a `size:` variant of their own, so there is nothing here
 *   for this rule to grade. That is a real reading and not a pass by absence — it is precisely the
 *   "no size variant at all" blind spot above, and it is why the floor below is asserted on the
 *   population rather than on the findings.
 */

/** Tailwind's `--spacing`, confirmed against the running stylesheet rather than assumed. */
const SPACING_REM = 0.25;
const BAR_PX = 24;

const tightestRootPx = Math.min(
  ...Object.values(themeData.densities).map((value) => Number.parseFloat(value)),
);

const toPx = (units: number) => units * SPACING_REM * tightestRootPx;

/**
 * What counts as a file that renders a button.
 *
 * `<Button` and `InputGroupButton` are in here because the first draft matched only `<button` and
 * `ark.button`, and therefore skipped `input-group.tsx` — the component whose `xs` was its own
 * *default*, and the worse of the two defects this exists to catch. A guard that cannot see the
 * case that motivated it is the failure mode every guard here owes a sentence about.
 */
const PRESSABLE = /ark\.button|<button|<Button|buttonVariants|InputGroupButton/;

/** Comments are not code: a JSDoc inside a `size: {}` block was being read as an entry. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Every `size: { … }` object body in a file, brace-matched rather than regexed to a closing line. */
function sizeVariantBodies(source: string): string[] {
  const bodies: string[] = [];
  for (const match of source.matchAll(/\bsize:\s*\{/g)) {
    let i = match.index + match[0].length;
    let depth = 1;
    while (i < source.length && depth > 0) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") depth--;
      i++;
    }
    bodies.push(source.slice(match.index + match[0].length, i - 1));
  }
  return bodies;
}

interface Finding {
  file: string;
  variant: string;
  utility: string;
  px: number;
}

const findings: Finding[] = [];
let recipesRead = 0;

for (const file of sourceFiles(/\.tsx$/)) {
  const source = stripComments(readFileSync(file, "utf8"));
  if (!PRESSABLE.test(source)) continue;

  for (const body of sizeVariantBodies(source)) {
    recipesRead++;
    for (const entry of body.matchAll(/"?([\w-]+)"?\s*:\s*(\[[^\]]*\]|"[^"]*")/g)) {
      const [, variant, value] = entry;
      for (const quoted of (value as string).matchAll(/"([^"]+)"/g)) {
        for (const token of (quoted[1] as string).split(/\s+/)) {
          // A variant prefix or an arbitrary child selector means the utility is not on this element.
          if (token.includes(":") || token.includes("&")) continue;
          const size = /^(?:min-h|h|size)-(\d+(?:\.\d+)?)$/.exec(token);
          if (!size) continue;
          const px = toPx(Number(size[1]));
          if (px < BAR_PX) {
            findings.push({ file: label(file), variant: variant as string, utility: token, px });
          }
        }
      }
    }
  }
}

describe("pressable floor", () => {
  it("reads a corpus, and the density scale it grades against", () => {
    // A guard over zero recipes passes every assertion under it.
    expect(recipesRead).toBeGreaterThanOrEqual(3);
    expect(tightestRootPx).toBe(14);
  });

  it("no button size variant is under 24 CSS pixels at the tightest density", () => {
    const report = findings
      .map((f) => `${f.file} · size="${f.variant}" · ${f.utility} = ${f.px}px`)
      .sort();
    expect(report, "a size variant promises a target smaller than WCAG 2.5.8 allows").toEqual([]);
  });
});
