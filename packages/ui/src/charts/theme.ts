"use client";

import { useEffect, useState } from "react";

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
  const m = computed.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/i);
  if (!m) return computed;
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => Math.round(Number(v) * 255));
  const a = m[4] != null ? Number(m[4]) : 1;
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
