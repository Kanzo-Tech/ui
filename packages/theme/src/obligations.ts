import themeDataJson from "../theme-data.json" with { type: "json" };

/**
 * What the density axis owes — the third section's obligations, in the graph section's shape.
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
export interface Obligation {
  id: string;
  subject: string;
  measured: number | null;
  threshold: number | null;
  holds: ">=" | "<=" | "<";
  unit: string;
  against: string;
  reason: string;
}

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

export const OBLIGATIONS: readonly Obligation[] = [
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
      "root and 21px at compact. Measured over three screens (keasy's dashboard and Discover, and a form) " +
      "at compact, **no `size=\"xs\"` button failed**: every undersized target was saved " +
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
    against: "the house floor, 11px at the default root (2026-11-04); WCAG sets no minimum type size",
    reason:
      "Not graded, because density is meant to shrink it. `--kanzo-font-size-small` is 0.6875rem, " +
      "11px at the default root and 9.63px at compact, and the scale emits nothing smaller: the " +
      "10px step was deleted with its last reader, Badge `xs`. The floor sits two steps below the " +
      "IDE tier's 13px base. What would close it: a guard that no recipe sets type below the token.",
  },
];

export interface Check extends Obligation {
  measured: number;
  threshold: number;
  ok: boolean;
}

/**
 * Grade every obligation carrying a number.
 *
 * Ungradeable rows are skipped rather than defaulted to passing, for the same reason the graph's
 * are: a bar nobody established cannot be cleared, and reporting one green is how a guard comes to
 * test a corpus of zero.
 */
export function check(): Check[] {
  return OBLIGATIONS.filter(
    (o): o is Obligation & { measured: number; threshold: number } =>
      o.measured !== null && o.threshold !== null,
  ).map((o) => ({
    ...o,
    ok:
      o.holds === ">="
        ? o.measured >= o.threshold
        : o.holds === "<="
          ? o.measured <= o.threshold
          : o.measured < o.threshold,
  }));
}
