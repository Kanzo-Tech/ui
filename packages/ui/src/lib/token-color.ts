// Token colour resolution — no engine, no hook, no directive.
//
// This half used to live in `charts/theme.ts`, which mixed it with two hooks and therefore carried
// `"use client"`. Two things broke as a result. `chart-config.ts` *calls* `categoricalColor`, so in
// an RSC graph a public `/analytics` export resolved to a client reference and a Server Component
// threw. And the placement rule (a part belongs on a subpath only if it imports that subpath's
// engine) put a twelve-line token resolver behind the DuckDB/Mosaic peer set — a WebGL graph and a
// docs helper both paid for the whole analytics stack to reach it.
//
// So the split is on the client boundary, not on the topic: everything here is pure, and the two
// hooks that read the live cascade live in `./theme-tick.js`. Both are on the root barrel.

import { CHART_SLOTS } from "@kanzo-tech/theme";

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
 * cascade the chart sits in. Read at mount and re-read on every theme change (see `useThemeTick`),
 * so a re-theme re-colours the marks — the vgplot analogue of the way CodeEditor's `var()`-backed
 * theme re-skins CodeMirror.
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
 * How many categorical slots the stylesheet declares. A 9th series folds into "Other" — never
 * cycle, or identity stops meaning anything.
 *
 * This file used to export the scheme's literal values too, first as eight hand-written hexes and
 * then as the default entry of `theme-data.json`. Both were a *second* source of truth beside
 * `--chart-*`, and that is the defect this whole colour layer exists to end: the same series was
 * one colour through `ChartConfig` and another through a token. It is gone, not relocated. The
 * tenant palette document owns the categorical set, `compile()` projects it onto these tokens, and
 * a chart reads the token — one answer, which follows the mode and follows the client.
 *
 * The count stays a compile-time constant because a stylesheet cannot have a variable number of
 * custom properties. How many of the slots carry a *real* category is the document's `capacity`,
 * which can be lower: past it, `compile` writes `var(--muted-foreground)`, and a set that carries
 * fewer categories than it has slots is saying so rather than inventing colours.
 */
export { CHART_SLOTS };

/**
 * The custom property carrying the document's `categorical.capacity`.
 *
 * `compile()` emits it at the head of both blocks — the one declaration in the sheet that is not a
 * colour, because it is the one fact about the set that the colours cannot carry. A custom property
 * and not a JS constant: the cascade is the only channel a scoped palette override travels down,
 * and it is the same channel `--chart-*` itself arrives on. A stylesheet that declares nothing
 * (anything older than the document, or a test fixture) falls back to `CHART_SLOTS`.
 *
 * Module-level only: `categoricalCapacity` is the way to read it, and an export whose whole use is
 * to be passed straight back into the function beside it is a second way to do one thing.
 */
export const CHART_CAPACITY_PROPERTY = "--chart-capacity";

/**
 * How many slots name a real category, read off the live cascade.
 *
 * `compile()` writes `var(--muted-foreground)` into every slot past capacity, so the *colour* of a
 * ninth series is already right without anyone knowing the number. What is not right is the
 * **count**: a legend that draws a row per slot claims eight distinguishable kinds where a set may
 * carry six, and any "group the tail into Other" logic folds at the wrong index. Measured over 24
 * brand hues one every 15° at L 0.62 / C 0.15, capacity came back 6–8 (mean 7.50) with 11 of the 24
 * under 8 — so this is the common case, not an edge one.
 *
 * Read against `host` rather than `<html>` for the same reason `resolveTokenColor` is: a scoped
 * palette override on an ancestor has to win.
 */
export function categoricalCapacity(host: Element): number {
  if (typeof getComputedStyle === "undefined") return CHART_SLOTS;
  const raw = getComputedStyle(host).getPropertyValue(CHART_CAPACITY_PROPERTY).trim();
  const declared = Number.parseInt(raw, 10);
  if (!Number.isFinite(declared) || declared <= 0) return CHART_SLOTS;
  return Math.min(declared, CHART_SLOTS);
}

/**
 * The categorical colour for series index `i`, as a **token**.
 *
 * A token and not a literal so one answer covers both jobs: it follows the light/dark flip, and it
 * follows whichever scheme the product selected — neither of which a baked hex can do. The chart
 * pipeline already resolves `var(--…)` against the live element, and the DOM resolves it natively
 * for legends and swatches.
 *
 * `capacity` is where the Other boundary sits. It defaults to `CHART_SLOTS` because that is the
 * only honest answer without a DOM to read — a caller with one passes `categoricalCapacity(host)`.
 */
export function categoricalColor(
  i: number,
  other = "var(--muted-foreground)",
  capacity = CHART_SLOTS,
): string {
  return i >= 0 && i < Math.min(capacity, CHART_SLOTS) ? `var(--chart-${i + 1})` : other;
}
