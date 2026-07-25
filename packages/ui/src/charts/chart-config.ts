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
