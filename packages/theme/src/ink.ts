// The ink a fill carries, and the maths under it.
//
// A theme is a flat block of hex and stays one — nothing here runs in a browser painting a page.
// This is authoring-time: it answers "you picked this fill, what text goes on it?" once, in a form,
// and the value it returns is written into the document as a literal. `a-theme-is-one-flat-block`
// is the rule this serves, not the one it bends: the derivation that decision cut was a
// multi-second categorical search shipped beside a stylesheet, and what replaced it was nobody
// computing the boring half at all — fifty-four hand-typed declarations per theme.
//
// ## The rule is daisyUI's, recovered from its output
//
// daisyUI has no derivation either: zero `oklch(from …)`, zero `color-mix` in 5.7.20, and
// `var(--color-primary-content)` is used bare 136 times with no fallback. But its 35 themes were
// clearly generated, and the formula reads straight off them. Of 280 fill/ink pairs, 156 carry the
// fill's hue to four decimal places, and within those:
//
// · fill light, ink dark  →  L × 0.2   (97/109 within ±0.5pp)   C × 0.2  (101/109 within ±0.005)
// · fill dark,  ink light →  L = 0.8 + 0.2·L   (exact on 31/47)
//
// One sentence: **carry the hue, cut the chroma to a fifth, and pull the lightness 80% of the way
// to the nearer end.** The 47 pairs that miss are pure-black fills where a person chose pure white,
// and the 124 that do not share the hue at all were adjusted by hand afterwards.
//
// ## Where we do not follow it
//
// daisyUI picks the branch on a lightness threshold — measured, its ink goes dark from L≥58.9 and
// light up to L≤56.9. Choosing instead by *which branch actually contrasts more* flips a little
// earlier (53–55% depending on chroma, so the two rules disagree over a narrow band) and it is the
// better question to ask, because the band they disagree over is exactly where the threshold picks
// the unreadable one.
//
// So {@link inkFor} takes daisyUI's value on the branch that contrasts more, and treats 4.5:1 as a
// floor rather than a hope: if that value does not clear AA it pushes the lightness on to the end,
// then lets the chroma go, then tries the other branch. Measured over 9,178 in-gamut fills spanning
// L, C and hue:
//
// | | below AA 4.5:1 | worst |
// |---|---|---|
// | daisyUI's own 280 shipped pairs | 40 (14.3%) | 3.04:1 |
// | the formula alone | 1,041 (11.3%) | 3.16:1 |
// | {@link inkFor} | **0** | **4.50:1** |
//
// The second departure is `LIGHT_PULL`, and it has its own note. Between the two, the distance from
// the plain formula is worth stating twice because the two numbers say different things: over
// daisyUI's own shipped pairs the median difference is ΔE 0.60 and 21 of 23 land within 8, so on
// the colours daisyUI actually chose these are the same rule. Over the synthetic sweep — which is
// mostly fills nobody would pick — 4,414 of 9,178 come back byte-identical and the median
// difference is ΔE 4.62, a just-noticeable step, concentrated on the pale branch.
//
// ## What this cannot prove
//
// **That the pair looks good.** AA is a floor on legibility, not a judgement about a palette, and a
// pair can clear 4.5:1 and still be ugly. The studio shows the number beside the swatch for that
// reason: the rule proposes, the author disposes, and what ships is whatever hex is in the file.
//
// **Anything about the fill's own contrast** against the surface it sits on. That is a different
// pair and `status.test.ts` is what measures it, over the themes that actually ship.

/** A colour in OKLCh. `l` is 0–1 (not a percentage), `h` is degrees. */
export interface Oklch {
  l: number;
  c: number;
  h: number;
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v * 255)));

/** A hex as OKLCh. */
export function oklch(hex: string): Oklch {
  const h = hex.trim().replace(/^#/, "");
  const [r = 0, g = 0, b = 0] = [0, 2, 4].map((i) =>
    toLinear(Number.parseInt(h.slice(i, i + 2), 16) / 255),
  );
  const lp = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const mp = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const sp = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * lp - 2.428592205 * mp + 0.4505937099 * sp;
  const B = 0.0259040371 * lp + 0.7827717662 * mp - 0.808675766 * sp;
  return {
    l: 0.2104542553 * lp + 0.793617785 * mp - 0.0040720468 * sp,
    c: Math.hypot(A, B),
    h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360,
  };
}

/**
 * OKLCh back to a hex, clamped into sRGB.
 *
 * Clamping is a real loss and it is the right one here: a proposal that lands outside sRGB has to
 * become *some* hex to go in the file, and the author sees the swatch and the ratio for the colour
 * that will actually ship rather than for the one the maths wanted.
 */
export function hex({ l, c, h }: Oklch): string {
  const rad = (h * Math.PI) / 180;
  const A = c * Math.cos(rad);
  const B = c * Math.sin(rad);
  const lp = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const mp = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const sp = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return `#${[
    toGamma(4.0767416621 * lp - 3.3077115913 * mp + 0.2309699292 * sp),
    toGamma(-1.2684380046 * lp + 2.6097574011 * mp - 0.3413193965 * sp),
    toGamma(-0.0041960863 * lp - 0.7034186147 * mp + 1.707614701 * sp),
  ]
    .map((v) => clamp(v).toString(16).padStart(2, "0"))
    .join("")}`;
}

const luminance = (hexValue: string): number => {
  const h = hexValue.trim().replace(/^#/, "");
  const [r = 0, g = 0, b = 0] = [0, 2, 4].map((i) =>
    toLinear(Number.parseInt(h.slice(i, i + 2), 16) / 255),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** The WCAG 2.x ratio between two opaque hexes, 1–21. Order does not matter. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The floor {@link inkFor} will not knowingly return below — WCAG AA for body text. */
export const AA = 4.5;

/**
 * The hue kept, the chroma at a fifth, the lightness pulled toward one end.
 *
 * `k` is how far. daisyUI's own value is 0.8 both ways, and this leans on `LIGHT_PULL` for the pale
 * branch instead — see the constant.
 */
const pull = (fill: Oklch, dark: boolean, k: number, chroma = 0.2): Oklch => ({
  l: dark ? fill.l * (1 - k) : fill.l + (1 - fill.l) * k,
  c: fill.c * chroma,
  h: fill.h,
});

/** daisyUI's, unchanged: a dark ink sits at a fifth of its fill's lightness. */
const DARK_PULL = 0.8;

/**
 * A pale ink goes further than daisyUI takes it — 0.9 of the way to white rather than 0.8.
 *
 * Measured, not preferred. Against daisyUI's own fixture the two are indistinguishable — 21 of 23
 * within ΔE 8 either way, median 0.60 — because daisyUI's dark fills are few and it hand-picked
 * most of their inks anyway. Against the 112 fill/ink pairs the sixteen themes here ship, 0.8
 * reproduces 84% and 0.9 reproduces **all of them**, and every one of 0.8's misses is the same
 * shape: a dark fill where the house wrote a near-white ink and daisyUI's constant stops at a
 * tinted grey.
 *
 * What it costs is real and small: on a synthetic sweep the pale branch now differs from daisyUI's
 * by ΔE 4.62 at the median where before it was identical. That is a just-noticeable step, paid on
 * fills nobody picked, to be exactly right on 112 that somebody did.
 *
 * Going all the way to white fits this house perfectly too and daisyUI barely at all (13 of 23),
 * which is what a constant overfitted to one corpus looks like. It was not taken.
 */
const LIGHT_PULL = 0.9;

/**
 * The *other* ink a status colour needs: the one that reads on the page, not on the fill.
 *
 * Shark's convention, and it catches people out because the two look like the same token wearing
 * different suffixes. `--destructive-content` is what sits **on** `--destructive` — white text in a
 * filled button. `--destructive-foreground` is destructive text on `--background` — an error line
 * under an input, where the fill never appears. One is a contrast pair with the fill, the other is
 * a member of the fill's family that survives being read at body weight on the page.
 *
 * So it is not {@link inkFor}: pulling to the far end would give near-black, which is not red any
 * more. It is the fill walked *toward the page's own ink* until it reads, which keeps the hue.
 *
 * Sixty percent, and the number is measured rather than chosen: across the sixteen themes this
 * repository ships it reproduces all four authored values at ΔE 4.6 in the worst case and about 3
 * at the median. The per-token optima were 60, 60, 59 and 62, which is one number with rounding on
 * it rather than four.
 */
export function pageInk(fill: string, ground: string): string {
  const [a, b] = [oklch(fill), oklch(ground)];
  const mix = (x: number, y: number) => x * 0.6 + y * 0.4;
  const rad = (v: Oklch) => (v.h * Math.PI) / 180;
  const A = mix(a.c * Math.cos(rad(a)), b.c * Math.cos(rad(b)));
  const B = mix(a.c * Math.sin(rad(a)), b.c * Math.sin(rad(b)));
  return hex({
    l: mix(a.l, b.l),
    c: Math.hypot(A, B),
    h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360,
  });
}

/** Walk one branch out to its end, giving up lightness first and chroma only when that runs out. */
function reach(fill: string, colour: Oklch, dark: boolean): string {
  const start = dark ? DARK_PULL : LIGHT_PULL;
  const base = hex(pull(colour, dark, start));
  if (contrast(fill, base) >= AA) return base;
  for (let k = start; k <= 1.0001; k += 0.01) {
    const candidate = hex(pull(colour, dark, k));
    if (contrast(fill, candidate) >= AA) return candidate;
  }
  for (let chroma = 0.2; chroma >= -0.0001; chroma -= 0.02) {
    const candidate = hex(pull(colour, dark, 1, chroma));
    if (contrast(fill, candidate) >= AA) return candidate;
  }
  return hex(pull(colour, dark, 1, 0));
}

/**
 * The ink that belongs on `fill` — a hex, ready to be written into a theme.
 *
 * Returns daisyUI's own value wherever that clears AA, and the nearest thing to it that does
 * wherever it would not. See the module docblock for the measurements behind both halves.
 */
export function inkFor(fill: string): string {
  const colour = oklch(fill);
  const dark =
    contrast(fill, hex(pull(colour, true, DARK_PULL))) >=
    contrast(fill, hex(pull(colour, false, LIGHT_PULL)));
  const first = reach(fill, colour, dark);
  if (contrast(fill, first) >= AA) return first;
  // The preferred branch can cap out below AA where the other one, pushed, does not.
  const second = reach(fill, colour, !dark);
  return contrast(fill, second) > contrast(fill, first) ? second : first;
}
