/**
 * What a section owes, as a row a test or a panel can read: a stable `id` a caller branches on, a
 * number, the bar it must clear, what the bar comes from, and the rule in one line.
 *
 * Declared here and imported by `@kanzo-tech/graph`, which grades its form the same way: two
 * sections publishing obligations is what makes "are these the same kind of thing?" an observation,
 * and one declaration is what keeps them the same shape.
 */
export interface Obligation {
  /** Stable key, so a caller branches on the failure rather than parsing prose. */
  id: string;
  /** What the number is a property of. */
  subject: string;
  /** The measured value, in `unit`. `null` means the obligation is real and not yet gradeable. */
  measured: number | null;
  /** The bar `measured` must clear, in `unit`. `null` where nobody has established one. */
  threshold: number | null;
  /** How `measured` must stand to `threshold`. */
  holds: ">=" | "<=" | "<";
  unit: string;
  /** What the bar comes from — an external system, a standard, or a measurement of ours. */
  against: string;
  /** The rule in one line. */
  reason: string;
}

/** An obligation and its grade: `ok` is `null` where the row carries no number to grade. */
export interface ObligationCheck extends Obligation {
  ok: boolean | null;
}

/**
 * Grade every row, and return every row.
 *
 * An ungradeable row is `ok: null`, never defaulted to passing: a bar nobody has established cannot
 * be cleared, and reporting one green is how a guard comes to test a corpus of zero.
 */
export function gradeObligations(rows: readonly Obligation[]): ObligationCheck[] {
  return rows.map((o) => {
    const { measured: m, threshold: t } = o;
    if (m === null || t === null) return { ...o, ok: null };
    return { ...o, ok: o.holds === ">=" ? m >= t : o.holds === "<=" ? m <= t : m < t };
  });
}
