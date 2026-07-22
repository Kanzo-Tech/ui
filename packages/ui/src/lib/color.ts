// Shared colour helpers for theming (used by the provider, the Preferences "Copy CSS"
// export, and the SSR pre-hydration script). Kept dependency-free and pure so it can be
// serialised into the inline theme script.

/** Relative luminance of a #hex colour (0..1); null when the string isn't a #hex. */
export function hexLuminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m?.[1]) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const ch = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
}

/** A readable foreground (#0a0a0a / #ffffff) for a given background colour. */
export function readableForeground(hex: string): string {
  const lum = hexLuminance(hex);
  return lum != null && lum > 0.5 ? "#0a0a0a" : "#ffffff";
}

// ── Custom base tint ──────────────────────────────────────────────────────────
// A "base" is a whole neutral RAMP (50→950), not a single colour — so a custom base can't be
// an arbitrary hex like an accent. Instead we tint the standard neutral ramp toward a chosen
// hue by a small amount (exactly what the curated mauve/olive/mist/taupe scales are), letting
// the browser do the maths with color-mix. The provider sets these as `--color-custom-*` and
// flips `data-base="custom"`; the generated `[data-base="custom"]` rules consume them.
export const CUSTOM_BASE_SHADES = [50, 100, 400, 500, 800, 950] as const;
/** Neutral-keep percentage — higher = subtler tint (8% tint keeps the surface near-neutral). */
export const CUSTOM_BASE_KEEP = 92;

/** `{ "--color-custom-50": "color-mix(...)", … }` for a tint colour. */
export function customBaseVars(tint: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of CUSTOM_BASE_SHADES) {
    out[`--color-custom-${s}`] = `color-mix(in srgb, var(--color-neutral-${s}) ${CUSTOM_BASE_KEEP}%, ${tint})`;
  }
  return out;
}
