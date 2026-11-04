import themeDataJson from "../theme-data.json" with { type: "json" };
import { gradeObligations, type Obligation, type ObligationCheck } from "./grading.js";

/*
 * What the density axis owes — the third section's obligations.
 *
 * Density sets the root font-size the whole `rem` scale resolves against, so it is a **multiplier
 * on every size the component layer declares**. That is what makes it a section rather than a
 * preference: it has a bar it can break.
 *
 * ## Whose obligation is it
 *
 * The reading this was written from: the base height belongs to `@kanzo-tech/ui`, the multiplier to
 * density, and WCAG measures the *product* — so the obligation sits with whoever can break it.
 *
 * **Measured, that reading needs one correction, and the correction matters.** The eleven genuine
 * 2.5.8 failures found in the showcases fail at the **default** density too (20.0 px tall, centres
 * 22.0 px apart) and clear only at comfortable. Density did not move a passing target to failing;
 * it made an already-failing one worse. So density is not the *owner* of the bar — it is a
 * multiplier on a bar **both** layers can break, and the component that declared a 1.25rem row
 * broke it first. The obligation is stated here because this is where the multiplier lives and
 * where the axis can be graded; the fix for a specific failure may well belong in `ui`.
 */
/** Root font-size per density, read from the generated table rather than re-typed. */
const DENSITIES: Record<string, string> = themeDataJson.densities;

/**
 * The steps are percentages of the BROWSER's font size, so they are graded at the browser default
 * of 16px. A person who enlarged their browser has larger targets than these figures, never smaller.
 */
const BROWSER_ROOT_PX = 16;
const px = (v: string) => (Number.parseFloat(v) / 100) * BROWSER_ROOT_PX;

/** The smallest root font-size the axis offers. Derived, so a new density step is graded too. */
const minRoot = Math.min(...Object.values(DENSITIES).map(px));

/**
 * The library's smallest interactive height, in `rem`, at the smallest density.
 *
 * `Button size="xs"` is `h-6` — 1.5rem. Written here as the rem figure and multiplied by the axis,
 * because the axis is what this file can grade; the 1.5 is `@kanzo-tech/ui`'s to change and a test
 * there is what would catch it moving.
 */
const SMALLEST_CONTROL_REM = 1.5;

const OBLIGATIONS: readonly Obligation[] = [
  {
    id: "target-size",
    subject: "the smallest interactive control, at the smallest density",
    measured: Number((SMALLEST_CONTROL_REM * minRoot).toFixed(2)),
    threshold: 24,
    holds: ">=",
    unit: "CSS px",
    against: "WCAG 2.5.8 Target Size (Minimum), AA",
    reason:
      "Every size in the library is `rem`, so the density axis multiplies every target. The " +
      "smallest control is `Button size=\"xs\"` at 1.5rem, which is exactly 24px at the default " +
      "root and 21px at compact. Measured over the app-shell, workspace and metadata-form " +
      "showcases at compact, **no `size=\"xs\"` button failed**: every undersized target was saved " +
      "by 2.5.8's spacing exception. The eleven genuine failures were a hand-rolled 1.25rem list " +
      "row, and they fail at the default density too — see the docblock above on ownership.",
  },
  {
    id: "x-height",
    subject: "the smallest type size the scale emits, at the smallest density",
    measured: null,
    threshold: null,
    holds: ">=",
    unit: "CSS px",
    against: "not established — WCAG sets no minimum type size, and this repo has set none either",
    reason:
      "Real and not gradeable, and saying so beats inventing a bar. `--kanzo-font-size-xs` is " +
      "0.625rem, which is 10px at the default root and 8.75px at compact. What would close it: a " +
      "house floor with a reason. The honest anchor already exists in the source — the IDE tier " +
      "justifies `--kanzo-font-size-base` as 13px, 'below Tailwind text-xs', which means the scale " +
      "was designed against a floor nobody wrote down. Writing that floor down is the work.",
  },
];

/** Every density obligation, graded — including the one nobody can grade yet. */
export function check(): ObligationCheck[] {
  return gradeObligations(OBLIGATIONS);
}
