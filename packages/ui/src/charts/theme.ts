"use client";

import { useEffect, useState } from "react";
import { themeData } from "@kanzo-tech/theme";

/**
 * Convert a browser-computed colour into the plain `rgb(...)` form Observable Plot accepts.
 *
 * Forcing a token through `color-mix(in srgb, …)` pins it to sRGB, but a modern browser then
 * *serialises* that as `color(srgb 0.61 0.61 0.61)` — and Plot's `isColor` (0.6.x) rejects the
 * `color()` function, so it mistakes the fill for a data column and the query dies with a binder
 * error. Canvas normalisation preserves `color(srgb …)` too, so we parse the sRGB components
 * ourselves. `rgb(...)` / `rgba(...)` / hex / named inputs (older browsers) pass straight through.
 */
function toPlotColor(computed: string): string {
  // The components may be negative or above 1: a wide-gamut token pinned to sRGB serialises
  // out of gamut (`color(srgb 0.96 0.28 -0.15)` for `--chart-1` in Chrome). Missing those was a
  // real failure, not a rounding detail — the unparsed string reached Plot, which read it as a
  // *column name* and killed the query with a binder error. Parse them, then clamp.
  const m = computed.match(
    /^color\(srgb\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)(?:\s*\/\s*([-+\d.eE]+))?\s*\)$/i,
  );
  if (!m) return computed;
  const channel = (v: string) => Math.min(255, Math.max(0, Math.round(Number(v) * 255)));
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => channel(v as string));
  const a = m[4] != null ? Math.min(1, Math.max(0, Number(m[4]))) : 1;
  return a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`;
}

/**
 * Resolve a Kanzo colour token to a concrete, Plot-safe `rgb(...)` string.
 *
 * vgplot delegates every fill to Observable Plot, whose `isColor` (0.6.x) accepts named colours,
 * hex and `rgb()`/`hsl()` — but **not** `var(--token)`, `color-mix()`, `oklch()` or `color(srgb …)`,
 * which is exactly how Tailwind v4's default palette (and therefore our tokens) is authored/served.
 * Hand Plot any of those and it treats the string as a data column, so the query fails.
 *
 * So we read the token off the live DOM through an `in srgb` `color-mix` (which pins it to sRGB)
 * and normalise the result to `rgb(...)` via {@link toPlotColor}. The probe is appended to `host`
 * so a scoped theme override (a `data-*` attribute on an ancestor) resolves against the same
 * cascade the chart sits in. Read at mount and re-read on every theme change (see
 * {@link useThemeTick}), so a re-theme re-colours the marks — the vgplot analogue of the way
 * CodeEditor's `var()`-backed theme re-skins CodeMirror.
 */
export function resolveTokenColor(host: Element, token: string): string {
  const probe = document.createElement("span");
  // The 0%-transparent second colour just keeps the first at full opacity; `in srgb` pins it.
  probe.style.color = `color-mix(in srgb, var(${token}) 100%, transparent)`;
  probe.style.display = "none";
  host.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  return resolved ? toPlotColor(resolved) : token;
}

/**
 * Re-render the caller when the theme changes.
 *
 * `KanzoThemeProvider` writes the theme axes as `data-*` attributes on `<html>`, next-themes
 * toggles `.dark` there, and a custom base tint writes inline `style` — all on
 * `document.documentElement`. Observing its attributes lets a token-backed chart re-resolve its
 * colours the moment the theme flips, instead of freezing whatever palette was live at mount.
 * Returns a counter to feed into an effect's dependency list.
 */
export function useThemeTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => setTick((t) => t + 1));
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);
  return tick;
}

/**
 * The default categorical scheme, as literal values.
 *
 * This used to be eight hand-written hexes here, which made it a *second* source of truth beside
 * `--chart-*` — and the two disagreed, so the same series was one colour through `ChartConfig` and
 * another through a token. It is now the default scheme out of `theme-data.json`, the same entry
 * the CSS tokens project. Compiled rather than resolved because that is what the references do
 * (d3 ships its schemes as hex strings) and because it is what lets a chart keep its colours where
 * the theme CSS is not loaded.
 *
 * Both modes clear the dataviz six checks against the product's own surfaces: worst adjacent CVD
 * ΔE 20.9, normal-vision 24.7, all eight at or above 3:1. The previous set sat in the CVD floor
 * band at 6.1 and needed secondary encoding to be legal at all.
 */
export const CHART_SCHEME = themeData.schemes[themeData.defaultScheme as keyof typeof themeData.schemes];

/** Categorical slots. A 9th series folds into "Other" — never cycle, or identity stops meaning anything. */
export const CHART_SLOTS = CHART_SCHEME.light.length;

/**
 * The categorical colour for series index `i`, as a **token**.
 *
 * A token and not a literal so one answer covers both jobs: it follows the light/dark flip, and it
 * follows whichever scheme the product selected — neither of which a baked hex can do. The chart
 * pipeline already resolves `var(--…)` against the live element, and the DOM resolves it natively
 * for legends and swatches.
 */
export function categoricalColor(i: number, other = "var(--muted-foreground)"): string {
  return i >= 0 && i < CHART_SLOTS ? `var(--chart-${i + 1})` : other;
}
