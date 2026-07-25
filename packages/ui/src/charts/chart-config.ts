import type { ComponentType, ReactNode } from "react";
import { categoricalColor } from "./theme.js";

export interface ChartSeriesConfig {
  /** Rendered by `ChartLegend` and used as the tooltip/legend name. Defaults to the key. */
  label?: ReactNode;
  /** `var(--chart-1)`, `--primary`, a hex or an `rgb()`. Tokens are resolved for the plot. */
  color?: string;
  /** An optional glyph for the legend row — the non-colour channel a swatch cannot carry alone. */
  icon?: ComponentType<{ className?: string }>;
}

/** Series key → presentation. Feeds the plot's colour scale, `ChartLegend` and the tooltip. */
export type ChartConfig = Record<string, ChartSeriesConfig>;

export interface ChartSeriesEntry {
  key: string;
  label: ReactNode;
  color: string;
  icon?: ComponentType<{ className?: string }>;
}

/** A CSS custom property reference — the one colour form Observable Plot cannot parse. */
export function isColorToken(value: string): boolean {
  return value.startsWith("var(--") || value.startsWith("--");
}

const COLOR_FUNCTION = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(/;
const HEX = /^#[0-9a-f]{3,8}$/;

/**
 * The CSS named colours, so the answer below does not depend on a DOM. Asking `CSS.supports` would
 * be shorter and is what Plot does, but jsdom ships `CSS` without `supports` — the test suite would
 * then disagree with the browser about `fill="red"`, which is worse than carrying the list.
 */
const NAMED_COLORS = new Set(
  ("aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen").split(" "),
);

/**
 * Is this channel value a **colour**, or the name of a **column**?
 *
 * A different question from {@link isColorToken}, which asks only whether we have to resolve the
 * value ourselves — and answering the second with the first was a bug: `fill="currentColor"` on a
 * stacking mark was read as a series column, so the query grouped by a colour keyword and died with
 * a binder error, silently, leaving the plot on its previous render.
 *
 * A column named exactly `red` would be read as a colour. That trade is deliberate: passing a
 * colour is common, naming a column after one is not, and both mistakes are silent — so the tie
 * goes to the frequent case.
 */
export function isColorValue(value: string): boolean {
  const v = value.toLowerCase().trim();
  if (v === "none" || v === "currentcolor" || v === "transparent") return true;
  if (isColorToken(v) || v.startsWith("url(")) return true;
  if (HEX.test(v) || COLOR_FUNCTION.test(v)) return true;
  return NAMED_COLORS.has(v);
}

/** `var(--chart-1, red)` → `--chart-1`. */
export function colorTokenName(value: string): string {
  if (!value.startsWith("var(")) return value.trim();
  const inner = value.slice(4, value.lastIndexOf(")"));
  const comma = inner.indexOf(",");
  return (comma === -1 ? inner : inner.slice(0, comma)).trim();
}

/** The config in slot order; a series without a colour falls back to its `CHART_CATEGORICAL` hue. */
export function chartSeriesEntries(config: ChartConfig): ChartSeriesEntry[] {
  return Object.entries(config).map(([key, series], i) => ({
    key,
    label: series.label ?? key,
    color: series.color ?? categoricalColor(i),
    icon: series.icon,
  }));
}

/** The colour a series wears — its own, or its `CHART_CATEGORICAL` slot. `undefined` if unknown. */
export function chartSeriesColor(config: ChartConfig, key: string): string | undefined {
  const index = Object.keys(config).indexOf(key);
  if (index === -1) return undefined;
  return config[key]?.color ?? categoricalColor(index);
}

/**
 * The plot's colour scale. Pinning the domain to the config keys is what keeps a hue bound to an
 * entity: without it vgplot orders the domain by the data, so filtering out a series repaints the
 * survivors. `null` when the config is empty — no scale attributes are emitted.
 */
export function chartColorScale(config: ChartConfig): { domain: string[]; range: string[] } | null {
  const entries = chartSeriesEntries(config);
  if (entries.length === 0) return null;
  return { domain: entries.map((e) => e.key), range: entries.map((e) => e.color) };
}
