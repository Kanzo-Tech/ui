// Theme colours as numbers a WebGL renderer can take.
//
// Resolution is the library's — `resolveTokenColor` from `@kanzo-tech/ui`. This file used
// to carry its own: a 1×1 canvas painted with the colour and read back through `getImageData`. Two
// implementations of one job, in two packages, sharing nothing and failing differently, for the
// same underlying reason — the theme is written in `oklch()` and `color-mix()`, cosmos.gl resolves
// through d3-color and Observable Plot through its own `isColor`, and neither knows either syntax.
// One browser probe, one place.
//
// What stays here is the part that is genuinely the graph's: the library answers `rgb(r, g, b)`
// because that is what Plot eats, and `setPointColors` wants four floats in 0..1.

import { resolveTokenColor } from "@kanzo-tech/ui";

export type Rgba = [number, number, number, number];

const FALLBACK: Rgba = [0.7, 0.7, 0.7, 1];
const CHANNELS = /(-?[\d.]+)/g;

/** `rgb(37, 99, 235)` / `rgba(37, 99, 235, 0.5)` → four floats. */
function parseRgb(css: string, fallback: Rgba): Rgba {
  const parts = css.match(CHANNELS)?.map(Number);
  if (!parts || parts.length < 3 || parts.some(Number.isNaN)) return fallback;
  const [r = 0, g = 0, b = 0, a = 1] = parts;
  return [r / 255, g / 255, b / 255, a];
}

/**
 * Any theme colour — a `var(--token)` or a literal — as GPU floats, resolved against `host`.
 *
 * `host` matters and is not ceremony: resolving against the element the canvas actually sits in is
 * what lets a scoped theme override win, which resolving against `<html>` would quietly lose.
 */
export function resolveToken(host: Element, value: string, fallback: Rgba = FALLBACK): Rgba {
  if (typeof document === "undefined" || !value) return fallback;
  const token = value.trim().replace(/^var\(\s*|\s*\)$/g, "");
  const resolved = resolveTokenColor(host, token.startsWith("--") ? token : value);
  return parseRgb(resolved, fallback);
}

const byte = (n: number) =>
  Math.round(Math.min(1, Math.max(0, n)) * 255)
    .toString(16)
    .padStart(2, "0");

/** cosmos.gl's *config* colours go through d3-color, so they have to be hex. */
export function toHex([r, g, b, a]: Rgba): string {
  return `#${byte(r)}${byte(g)}${byte(b)}${a >= 1 ? "" : byte(a)}`;
}

export function withAlpha([r, g, b]: Rgba, alpha: number): Rgba {
  return [r, g, b, alpha];
}
