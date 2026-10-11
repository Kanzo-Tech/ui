/**
 * **How faint a greyed-out point is: derived per theme, never chosen** (`/docs/design/crossfilter#the-greyout`).
 *
 * The criterion is WCAG 2.2 SC 1.4.11 at 3 : 1 between a kept mark and the same mark greyed out:
 * what a filter kept is read from that difference. Among the opacities that hold it, the largest is
 * taken, so the greyed context is as visible as the criterion allows. It is computed at runtime, from
 * the colours the canvas paints and the background it paints on, both resolved from the live theme's
 * tokens — a theme changes at runtime and a host may bring its own, which no build-time table covers.
 *
 * The model is what reaches the screen, one mark over the background:
 *
 * - **The greyed colour is cosmos.gl's** (3.4.0, `dist/index.js:5239-5256`, no `pointGreyoutColor`):
 *   `mix(c, 0.2, 0.65)` on a background whose luminance — cosmos.gl's, on its 0..1 channels
 *   (`index.js:141`) — is below 0.65, else `mix(c, max(background, 0.8), 0.65)`.
 * - **At opacity `α` it is composited over the background**, `α·g + (1 − α)·b` per channel, and the
 *   screen shows it in 8-bit sRGB, so each channel is rounded to a byte before it is measured.
 * - **Contrast is WCAG's**: relative luminance from linearised sRGB, `(L₁ + 0.05) / (L₂ + 0.05)`.
 *
 * `α` is searched on a grid of thousandths from 0 upward, and the answer is the last opacity before
 * the first that breaks the criterion, so every smaller opacity holds it too — no monotonicity of
 * contrast in `α` is assumed. A colour that is under 3 : 1 against the background is under it at every
 * opacity; it already fails SC 1.4.11 as a kept mark, the greyout cannot mend it, and it is left out
 * of the search. With no colour left, there is no distinction to protect, and cosmos.gl's own
 * default, full opacity, stands.
 */

/** A colour as three 0..1 sRGB channels. */
export type Rgb = readonly [number, number, number];

/** WCAG 2.2 SC 1.4.11: a graphical object against what it must be told from. */
export const NON_TEXT_CONTRAST = 3;

/** The grid `α` is searched on. */
const STEPS = 1000;

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const byte = (c: number) => Math.round(Math.min(1, Math.max(0, c)) * 255) / 255;

/** WCAG relative luminance of an sRGB colour, rounded to the bytes a screen shows. */
export function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((c) => linear(byte(c))) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG contrast ratio of two colours, 1–21. */
export function contrastOf(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** cosmos.gl's greyed colour for `colour` on `background`, before its opacity. */
export function greyedOf(colour: Rgb, background: Rgb): Rgb {
  const dark = 0.2126 * background[0] + 0.7152 * background[1] + 0.0722 * background[2] < 0.65;
  const toward = dark ? [0.2, 0.2, 0.2] : background.map((c) => Math.max(c, 0.8));
  return colour.map((c, i) => c * 0.35 + (toward[i] as number) * 0.65) as unknown as Rgb;
}

/** `colour` at `alpha` over `background`: what the screen shows. */
export const over = (colour: Rgb, alpha: number, background: Rgb): Rgb =>
  colour.map((c, i) => alpha * c + (1 - alpha) * (background[i] as number)) as unknown as Rgb;

/**
 * **The largest greyout opacity that keeps every colour at 3 : 1 from itself greyed**, in thousandths:
 * `pointGreyoutOpacity` for a canvas painting `colours` on `background`.
 */
export function greyoutOpacity(colours: readonly Rgb[], background: Rgb): number {
  const told = colours.filter((c) => contrastOf(c, background) >= NON_TEXT_CONTRAST);
  if (told.length === 0) return 1;
  const greyed = told.map((c) => greyedOf(c, background));
  const holds = (alpha: number) => told.every((c, i) => contrastOf(c, over(greyed[i]!, alpha, background)) >= NON_TEXT_CONTRAST);
  let k = 0;
  while (k < STEPS && holds((k + 1) / STEPS)) k++;
  return k / STEPS;
}
