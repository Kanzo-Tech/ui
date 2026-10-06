/**
 * What each channel is bound to — Plot's names, and Plot's rule that **a CSS colour is a constant
 * and anything else is a column.** `fill="kind"` spends colour on a category; `fill="var(--foreground)"`
 * paints every point one ink and leaves colour free to mean the selection.
 */
export interface Channels {
  /** Which column colours a point, or a CSS colour every point wears. Absent, colour is the vertex type. */
  fill?: string;
  /**
   * Which column a point's shape carries. The graph holds one categorical column, so bound beside a
   * `fill` column this reads the same one; a second would need a second array everywhere.
   */
  symbol?: string;
  /** What tints a link. Absent, a link takes the colour of the vertex it leaves. */
  stroke?: string;
  /**
   * Two numeric columns a point is drawn at — `lon` and `lat` draw a map. Both bound, the data
   * places the points and nothing simulates; unbound, the layout does, on the GPU.
   */
  x?: string;
  y?: string;
  /** Which column a running layout pulls points together by — cosmos.gl's cluster force. */
  cluster?: string;
}

/** Narrow on purpose — `var(…)`, a hex, a colour function — so a bare word is always a column. */
export function isColour(value: string | undefined): value is string {
  return value !== undefined && /^(var\(|#|rgb|hsl|oklch|oklab|lab|lch|color\()/i.test(value);
}

/** The columns a binding reads. */
export interface Binding {
  /** The one categorical column: `fill` when it names one, `symbol` when `fill` is a constant or absent. */
  readonly category: string | undefined;
  /** No column and no constant: the category is the vertex type. */
  readonly byTable: boolean;
  /** What the size ramp is spent on — Plot's `r`. */
  readonly size: string | undefined;
  /** The text a label and the hover card show — Plot's `title`. */
  readonly title: string | undefined;
  readonly x: string | undefined;
  readonly y: string | undefined;
  readonly cluster: string | undefined;
}

export function bindingOf(options: Channels & { r?: string; title?: string }): Binding {
  const constant = isColour(options.fill);
  const category = constant ? options.symbol : (options.fill ?? options.symbol);
  return {
    category,
    byTable: !constant && category === undefined,
    size: options.r,
    title: options.title,
    x: options.x,
    y: options.y,
    cluster: options.cluster,
  };
}

/** The three channels that say where the points come from. */
export type Placement = Pick<Channels, "x" | "y" | "cluster">;

/**
 * **Where the points come from, read off `GRAPH_SECTION`'s placement** — the third reader beside
 * `lookFrom` and `simFrom`, and the same shape: a section's resolved strings in, the root's props out.
 *
 * The mode decides which columns apply, and the others are kept rather than cleared: going back to
 * the map finds the columns where the reader left them. An empty column is unbound, which is what
 * Ark's cleared `Select` stores.
 */
export function placementFrom(values: Readonly<Record<string, string>> = {}): Placement {
  const column = (key: string) => values[key] || undefined;
  if (values.placement === "map") {
    const x = column("x-by");
    const y = column("y-by");
    return { ...(x ? { x } : {}), ...(y ? { y } : {}) };
  }
  if (values.placement === "clustered") {
    const cluster = column("cluster-by");
    return cluster ? { cluster } : {};
  }
  return {};
}
