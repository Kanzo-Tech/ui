/**
 * What each channel is bound to — Plot's names, and Plot's rule that **a CSS colour is a constant
 * and anything else is a column.** `fill="kind"` spends colour on a category; `fill="var(--foreground)"`
 * paints every point one ink and leaves colour free to mean the selection.
 */
export interface Channels {
  /** Which column colours a point, or a CSS colour every point wears. */
  fill?: string;
  /**
   * Which column a point's shape carries. A tile carries one categorical column, so bound beside a
   * `fill` column this reads the same one; a second would need a second array everywhere.
   */
  symbol?: string;
  /** What tints a link. Absent, a link takes the colour of the vertex it leaves. */
  stroke?: string;
}

/** Narrow on purpose — `var(…)`, a hex, a colour function — so a bare word is always a column. */
export function isColour(value: string | undefined): value is string {
  return value !== undefined && /^(var\(|#|rgb|hsl|oklch|oklab|lab|lch|color\()/i.test(value);
}

/** The columns a binding reads, which is what a scan projects. */
export interface Binding {
  /** The one categorical column: `fill` when it names one, `symbol` when `fill` is a constant. */
  readonly category: string | undefined;
  /** What the size ramp is spent on — Plot's `r`. */
  readonly size: string | undefined;
  /** The text a label and the hover card show — Plot's `title`. */
  readonly title: string | undefined;
}

export function bindingOf(options: Channels & { r?: string; title?: string }): Binding {
  return {
    category: isColour(options.fill) ? options.symbol : options.fill,
    size: options.r,
    title: options.title,
  };
}

/** A binding is a projection: `fill`, `r` and `title` as columns become the scan's `select`. */
export function projectionOf(binding: Binding, fixed: readonly string[]): string[] {
  return [...new Set([...fixed, binding.category, binding.size, binding.title].filter((c) => c !== undefined))];
}
