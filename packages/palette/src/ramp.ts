import {
  BAND,
  CHROMA_FLOOR,
  CONTRAST_MIN,
  SURFACE,
  TEXT_MIN,
  contrast,
  deltaE,
  hueDistance,
  oklch,
  type Mode,
} from "./palette-check.js";

/**
 * A ramp: one seed colour, twelve steps, each carrying a measured obligation.
 *
 * Three anchors and a growth rate produce twelve values, and `checkRamp` re-measures every
 * obligation afterwards. Where a seed cannot meet one, the fact is **published** in `relief` rather
 * than repaired by nudging the step: a value quietly moved to pass a gate is a gate that no longer
 * means anything.
 *
 * **Radix Colors' 12-step scale is the reference for what each step is *for*.** It is not the
 * reference for the values: we generate, because generating is what keeps the gates. Every constant
 * below that could have been a taste decision is instead measured off Radix's 25 chromatic scales in
 * both modes, and the measurement is quoted beside it.
 */

/** Steps 1–12. The index in `Ramp.steps` is the step number minus one. */
export const RAMP_LENGTH = 12;

/**
 * How much of step 9's chroma each step carries.
 *
 * Measured: the mean of `c(step) / c(step 9)` over Radix's 25 chromatic scales, per mode, in OKLCH.
 * Dimensionless and hueless — a shape, not a colour — which is why it can be a table without
 * violating "no hue is written by hand".
 *
 * The dark profile is *fatter* at the bottom (0.30 at step 3 against 0.19 in light), because a tint
 * has to work harder against a dark ground. That asymmetry is one of the reasons light and dark are
 * separate generations rather than a flip.
 */
export const CHROMA_PROFILE: Record<Mode, readonly number[]> = {
  light: [0.024, 0.076, 0.189, 0.297, 0.394, 0.481, 0.579, 0.747, 1.0, 0.988, 0.89, 0.46],
  dark: [0.101, 0.136, 0.302, 0.432, 0.488, 0.528, 0.587, 0.698, 1.0, 0.958, 0.871, 0.383],
};

/**
 * The same shape, measured as the mean of `c(i)/c(9)` across Radix's five tinted greys — mauve,
 * slate, sage, olive, sand — which sit at c 0.010–0.019, deliberately under `CHROMA_FLOOR`.
 *
 * It diverges from `CHROMA_PROFILE` only at the bottom: 0.136 against 0.024 at step 1 in light. In
 * absolute terms Radix's step 1 sits at 0.0036 chromatic against 0.0017 tinted, a factor of 2, where
 * step 9 differs by a factor of 12. **The low steps carry a fixed amount of tint, not a fixed
 * fraction**, which is why a purely proportional profile collapses to nothing exactly when the seed
 * is a neutral. `tintedChroma` is that finding as one line.
 */
export const TINT_PROFILE: Record<Mode, readonly number[]> = {
  light: [0.136, 0.193, 0.271, 0.324, 0.441, 0.471, 0.578, 0.755, 1.0, 0.954, 0.829, 0.818],
  dark: [0.231, 0.226, 0.261, 0.368, 0.43, 0.514, 0.603, 0.801, 1.0, 0.93, 0.71, 0.184],
};

/**
 * The chroma at which `TINT_PROFILE` *is* the answer: the mean step 9 of those same five scales.
 *
 * A reference point, not a threshold — nothing switches here. Above it a seed is more saturated than
 * any neutral Radix ships, so the tint floor stops rising and the proportional profile takes over.
 */
export const TINT_REFERENCE: Record<Mode, number> = { light: 0.0136, dark: 0.0158 };

/**
 * The chroma of step `i`, for any seed from a barely-there tint to a full brand colour.
 *
 * `min(c9, TINT_REFERENCE)` keeps the floor honest at both ends. A seed more saturated than a Radix
 * neutral gets no lift at all — every chromatic ramp in the suite is byte-identical to what it was
 * before this existed. A seed *less* saturated than one gets the floor scaled down with it, so the
 * ramp can never be more colourful than the colour it was built from, and chroma still peaks at
 * step 9 where every obligation expects it.
 */
function tintedChroma(mode: Mode, index: number, c9: number): number {
  const floor = Math.min(c9, TINT_REFERENCE[mode]);
  return Math.max(
    (CHROMA_PROFILE[mode][index] as number) * c9,
    (TINT_PROFILE[mode][index] as number) * floor,
  );
}

/**
 * How fast the lightness increments grow as the ramp walks away from the surface.
 *
 * Measured as the geometric mean of Radix's own per-position increment ratios (steps 2→8, where the
 * progression is regular): 1.20, 1.18, 1.26, 1.33, 1.35, 1.73 in light and 0.78, 1.03, 1.14, 1.26,
 * 1.25, 1.90 in dark. Dark grows more slowly because its whole lower arc is compressed into the
 * bottom of the lightness range.
 */
export const GROWTH: Record<Mode, number> = { light: 1.33, dark: 1.18 };

/**
 * Steps 1 and 2 are documented as interchangeable, so the first increment is a fraction of the next.
 *
 * Measured: Radix's step 2→3 increment is 2.08× its 1→2 increment in light and 2.40× in dark.
 */
export const FIRST_SPLIT: Record<Mode, number> = { light: 2.08, dark: 2.4 };

/** Keeps a step from failing its own band check on the last digit of hex rounding. */
const BAND_INSET = 0.002;

/**
 * How far step 10 sits from step 9, in OKLCH lightness.
 *
 * Its own constant rather than a term of the progression, because it is one solid's hover: what it
 * owes is a *perceptible* change and nothing else. Measured, Radix's own 9→10 is ΔE 3.0 in light and
 * 4.4 in dark, and a pure lightness move of 0.03 is ΔE 3.0 by definition — the progression's own
 * increment is smaller than that for any seed whose lower arc is short, which is how a hover ends up
 * invisible on exactly the hues that most need one.
 */
const SOLID_HOVER = 0.03;

// A requested chroma that sRGB cannot hold comes back as *less chroma*, never as a shifted hue, or
// the ramp would silently retint itself at its own extremes.

const encode = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function linearFromOklch(l: number, c: number, h: number): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
}

const GAMUT_EPS = 1e-4;
const inGamut = (l: number, c: number, h: number) =>
  linearFromOklch(l, c, h).every((v) => v >= -GAMUT_EPS && v <= 1 + GAMUT_EPS);

/**
 * The most chroma sRGB holds at this lightness and hue.
 *
 * Bisection rather than an analytic cusp: the boundary is a piecewise-cubic surface, and thirty
 * halvings of a 0.45-wide interval land inside a thousandth of a chroma unit — an order of magnitude
 * below what an 8-bit channel can express.
 */
export function maxChroma(l: number, h: number): number {
  let lo = 0;
  let hi = 0.45;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(l, mid, h)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** OKLCH to hex, with chroma reduced — never hue rotated — until the colour fits sRGB. */
export function toHex(l: number, c: number, h: number): string {
  const lc = Math.min(1, Math.max(0, l));
  const cc = Math.min(c, maxChroma(lc, h));
  const [r, g, b] = linearFromOklch(lc, cc, h);
  return `#${[r, g, b]
    .map((v) => Math.round(255 * Math.min(1, Math.max(0, encode(v)))).toString(16).padStart(2, "0"))
    .join("")}`;
}

// ── Alpha ───────────────────────────────────────────────────────────────────────────────────────
//
// A second scale, `a1..a12`, meant to sit over content the ramp does not control. Diluting the solid
// toward transparent cannot do this job: the result is a function of what is underneath, and matches
// the ramp's own step only over a white page.
//
// **What an alpha step owes is fidelity, not contrast.** The background it will sit on is unknown by
// construction, so no contrast obligation is even well-formed; what is well-formed is that over the
// ramp's own page the alpha step is indistinguishable from its solid.
//
// Measured against the reference: Radix's alpha scales composite to their solid scales at ΔE 0.00
// over `#ffffff` in light, and in dark the target is `#111111` (gray ΔE 0.00, blue 0.65) — *not*
// pure black, where the same comparison is out by up to ΔE 17.8. The declared background is the
// thing to get right.

const srgb255 = (hex: string) => {
  const h = hex.replace(/^#/, "");
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
};
const hex2 = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");

/**
 * The ΔE the solver is allowed to spend buying transparency, under the obligation's own tolerance.
 *
 * Not slack. Our alpha base is the ramp's **own step 1**, not a pure extreme: Radix composites over
 * `#ffffff` in light, but our page is `#fafafa` with a tint on it, so a scale built over white would
 * be right on a page we do not render. The cost is that a target channel pinned at the gamut edge is
 * only reachable at full opacity. Measured, insisting on ΔE 0.5 made eight dark ramps 58% opaque at
 * step 4 where step 5 was 29%; at ΔE 1, still under a just-noticeable difference, the same steps
 * land at 29–52% and the scale is monotone through the arc that matters.
 */
const ALPHA_SOLVE = 1;

/** The source colour that composites closest to `target` over `background` at a given alpha byte. */
function sourceAt(target: string, background: string, byte: number): string {
  const a = byte / 255;
  const t = srgb255(target);
  const b = srgb255(background);
  const source = t.map((ti, i) => Math.min(1, Math.max(0, (ti - (b[i] as number) * (1 - a)) / a)));
  return `#${source.map(hex2).join("")}${byte.toString(16).padStart(2, "0")}`;
}

/**
 * The most transparent colour that composites to `target` over `background`.
 *
 * Compositing is per-channel and linear *in sRGB* — what a browser does — so reach is monotone in
 * alpha and the smallest byte inside the budget can be bisected for.
 *
 * Bisection rather than the closed form: the closed form asks the source colour to stay inside 0–1,
 * so a target whose channel sits one level past the background's — an orange step 2 at red 255 over
 * a step 1 at red 254 — is only reachable at *full* opacity, and eleven of the twelve steps came
 * back opaque. A single 8-bit level is ΔE ≈ 0.1, well inside the tolerance the obligation already
 * grants.
 */
export function alphaOver(target: string, background: string): string {
  if (target === background) return `${background}00`;
  let lo = 0;
  let hi = 255;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (mid > 0 && deltaE(over(sourceAt(target, background, mid), background), target) <= ALPHA_SOLVE) {
      hi = mid;
    } else lo = mid + 1;
  }
  // Reach is monotone in alpha, but 8-bit rounding of the source colour is not, so the crossing can
  // sit a level or two off. Walking up from it costs at most a few steps and cannot overshoot,
  // where trusting the bisection blindly would ship an alpha step that misses its own solid.
  while (lo < 255 && deltaE(over(sourceAt(target, background, lo), background), target) > ALPHA_SOLVE) {
    lo += 1;
  }
  return sourceAt(target, background, lo);
}

/** Composite an 8-digit hex over an opaque one, the way a browser does: per channel, in sRGB. */
export function over(source: string, background: string): string {
  const h = source.replace(/^#/, "");
  const alpha = h.length === 8 ? Number.parseInt(h.slice(6, 8), 16) / 255 : 1;
  const s = srgb255(`#${h.slice(0, 6)}`);
  const b = srgb255(background);
  return `#${s.map((v, i) => hex2(v * alpha + (b[i] as number) * (1 - alpha))).join("")}`;
}

// ── The obligations ─────────────────────────────────────────────────────────────────────────────

/** What a step must do, why, and against what. One row per obligation, and the check iterates it. */
export interface Obligation {
  /** 1-based step number; `0` for a whole-ramp obligation. */
  step: number;
  /** Stable key, used in `relief` so a caller can branch on the failure rather than parse prose. */
  id: string;
  /** The rule in one line, for a panel that has to explain a warning. */
  reason: string;
}

/**
 * Every obligation, in step order. The three that come straight from WCAG are marked as such; the
 * rest are derived from Radix's documented intent for the step, and each cites the measurement that
 * fixed its threshold.
 */
export const OBLIGATIONS: readonly Obligation[] = [
  {
    step: 1,
    id: "surface",
    reason:
      "Step 1 is the page. It must be the mode's own surface, because every contrast this package " +
      "measures is measured against SURFACE[mode] — a ramp with a different background would be " +
      "grading itself against a page nobody renders.",
  },
  {
    step: 2,
    id: "interchangeable",
    reason:
      "Radix documents steps 1 and 2 as interchangeable: a striped row or a card is a change of " +
      "surface, not a change of level. So the obligation is two-sided and both sides are loose — " +
      "distinct at 8 bits (ΔE ≥ 0.5, about one channel level at the light end, below which one of " +
      "twelve steps is spent on nothing) and never a border (ΔE ≤ 4). Radix's own 1→2 measures " +
      "1.0–3.6; ours 0.8–1.5 in light and 2.4–3.6 in dark.",
  },
  {
    step: 4,
    id: "hover",
    reason:
      "Steps 3/4/5 are one component's normal, hover and active surface. A hover a user cannot see " +
      "is not a hover: each must clear ΔE 2 from the last. Radix's own 3→4→5 measure 2.2–6.0.",
  },
  {
    step: 5,
    id: "active",
    reason: "Same as step 4 — the active surface must be visibly past the hover, not merely past normal.",
  },
  {
    step: 5,
    id: "still-a-surface",
    reason:
      "A component surface must not be as loud as a border, or steps 3–5 and 6–8 stop being two " +
      "different things. Below CONTRAST_MIN against step 1; Radix's step 5 measures 1.22–1.81.",
  },
  {
    step: 0,
    id: "control-boundary",
    reason:
      "WCAG 1.4.11 asks 3:1 of the visual boundary that identifies an interactive component — a " +
      "focus ring, an input outline. The ramp does not assert that step 8 is that step; it reports " +
      "which step first reaches it (`boundary`) and owes only that one exists at or before the " +
      "solid. That bound is the whole guarantee. Which step it lands on is dominated by the mode " +
      "but not decided by it — measured over 118 seeds it is 9 in light 97 times and 8 the other " +
      "21, and 8 in dark 82 times and 9 the other 36 — so a role table must read the field and can " +
      "never hard-code a number. Steps 6 and 7 are non-interactive separators, which 1.4.11 " +
      "exempts, and carry no contrast duty at all.",
  },
  {
    step: 9,
    id: "visible-fill",
    reason:
      "A solid fill must read as a shape at CONTRAST_MIN against the page. This package has already " +
      "paid for the alternative twice over: emerald-500 and amber-500 measured 2.37 and 2.05, a " +
      "filled badge was barely visible, and the fix was to move every status fill to -600. Step 9 " +
      "is therefore the seed pulled *away from the surface until it reaches 3:1*, not the seed as " +
      "given — which reproduces that -500→-600 decision from the rule instead of by hand. What the " +
      "pull cost is published in `drift`, never swallowed.",
  },
  {
    step: 9,
    id: "in-band",
    reason:
      "Step 9 is where a categorical slot, a status fill and the brand all come from, so it has to " +
      "sit in the lightness band those already answer to — BAND[mode], measured per mode because an " +
      "automatic flip of a light value lands outside the dark one.",
  },
  {
    step: 9,
    id: "carries-identity",
    reason:
      "Below CHROMA_FLOOR a hue stops doing identity work and reads as grey. A base seed takes " +
      "this relief by construction, which is the honest answer rather than a manufactured tint.",
  },
  {
    step: 10,
    id: "solid-hover",
    reason: "Step 10 is step 9's hover: ΔE 2 from it, and still a visible fill at CONTRAST_MIN.",
  },
  {
    step: 11,
    id: "text-on-page",
    reason: "WCAG AA for small text (TEXT_MIN) against step 1. Low-contrast text is still text.",
  },
  {
    step: 11,
    id: "text-on-fill",
    reason:
      "This system's documented naming contract is that `-foreground` is the ink meant to sit ON " +
      "the fill of the same name (tokens.css) — so `--muted-foreground` on `--muted` is not a " +
      "hypothetical pairing, it is the rule. The loudest fill it can land on is step 5. Radix does " +
      "not guarantee this (its step 11 measures 3.19–4.58 on step 5); we do, and it is the reason " +
      "our step 11 runs darker than Radix's.",
  },
  {
    step: 12,
    id: "strong-text-on-page",
    reason: "WCAG AAA for small text (7:1) against step 1. Step 12 is the maximum-contrast ink.",
  },
  {
    step: 12,
    id: "strong-text-on-fill",
    reason: "AA on step 5, for the same reason as step 11 — `--secondary-foreground` sits on `--secondary`.",
  },
  {
    step: 0,
    id: "monotone",
    reason:
      "Lightness moves away from the surface and never back. Every consumer leans on the order — " +
      "`palettes.test.ts` already asserts it of base00→base05 — and a ramp out of order still " +
      "renders, just wrongly and quietly.",
  },
  {
    step: 0,
    id: "hue-held",
    reason:
      "Every step carries the seed's hue, graded as the offset it produces in a/b rather than as an " +
      "angle: 3° at the chroma where a hue begins doing identity work, which is ΔE 0.52. Stated as " +
      "an angle the rule cannot reach the bottom of a ramp — a tinted step 1 sits 30° off and is " +
      "still the right colour, because 30° of c 0.0017 is ΔE 0.06 — and a chroma filter to keep it " +
      "honest graded 0 of 96 steps on the tinted ramps. Gamut mapping reduces chroma rather than " +
      "rotating hue precisely so this holds; a ramp that drifted would be writing a hue nobody " +
      "chose, which is the rule `no-literal-hues.test.ts` exists for.",
  },
  {
    step: 0,
    id: "alpha-fidelity",
    reason:
      "Every alpha step, composited over step 1, is its solid step. That is the only obligation an " +
      "alpha step can carry — the background it will really sit on is unknown by construction, so " +
      "no contrast rule about it is even well-formed — and it is the one that makes the scale " +
      "usable: a component built on `a3` and one built on `3` are the same component until " +
      "something is put behind it. Radix's own scales meet it to ΔE 0.00 over their declared " +
      "background. Tolerance ΔE 1, which is 8-bit quantisation of both the alpha byte and the " +
      "source colour, not slack.",
  },
  {
    step: 0,
    id: "on-solid",
    reason:
      "The ink that sits on step 9 must clear AA. Radix has no counterpart step for it — a scale " +
      "names which of white or black to use and stops — so it is chosen here by measurement, the " +
      "way this package already splits `--*-content`: the ramp's own extremes first, because they " +
      "belong to the identity, and the achromatic extremes only when neither clears AA. Measured, " +
      "the fallback is what rescues indigo (step 1 reaches 4.39, white 4.86) and a neutral dark " +
      "ramp (4.18 and 4.06 from its own ends, 4.70 from white).",
  },
];

/**
 * Below this chroma a seed has no hue worth keeping — **measured, not chosen**.
 *
 * Three regimes, not two: a seed can be *noise* (the angle is float error in a/b), a *tint* (a hue
 * given deliberately, low because that is what a neutral is), or an *identity* (a brand colour).
 * This constant is the noise/tint boundary; `CHROMA_FLOOR` is the tint/identity one. One rule
 * answering both questions is what turns a client's tinted neutral into pure grey.
 *
 * Measured by building the twelve steps at every hue and comparing them to the pure-grey ramp: at
 * c 0.0030 the largest difference over all hues and all steps is ΔE 0.41 in light and 0.42 in dark;
 * at c 0.0035 it is 0.52 and 0.51. `DISTINCT` lands the threshold at 0.0035 in both modes, which is
 * the sign it is a property of the encoding rather than of the palette. Above it, flattening throws
 * away a colour the client chose: Radix's five tinted greys sit at c 0.010–0.019.
 */
export const TINT_FLOOR = 0.0035;

const HUE_TOLERANCE = 3;
/** `HUE_TOLERANCE` as the thing it stands for: how far off the seed's hue a step may sit in a/b. */
const HUE_OFFSET = 100 * CHROMA_FLOOR * Math.sin((HUE_TOLERANCE * Math.PI) / 180);
/** One 8-bit channel level near white, in the ΔE the rest of this package uses. */
const DISTINCT = 0.5;
const PERCEPTIBLE = 2;
const INTERCHANGEABLE = 4;
const STRONG_TEXT = 7;
/** The obligation's own bar, above what the solver spends so the gate is never what decides. */
const ALPHA_TOLERANCE = 1.5;
/** The two colours a readable-foreground calculation is allowed to pick between. */
const ACHROMATIC = ["#ffffff", "#000000"] as const;

/**
 * Where a search for the quietest ink may start — see `Ramp.quietestInk`.
 *
 * **Not 11, and the difference is the whole reason this is a search.** Radix documents step 11 as
 * low-contrast text and step 10 as hovered solid, so by the scale's own semantics the ink band opens
 * at 11. But a quiet ink wants to be *quieter than* the secondary text at step 11, and on most ramps
 * step 10 is both quiet enough and legible — for a neutral it is a lightness and nothing else, since
 * there is no fill for it to be the hover of. So the floor is 10 and the ramp answers whether it
 * holds.
 *
 * Starting at 1 instead would be wrong in a way that is easy to miss: measured on Kanzo's neutral,
 * the first step to clear AA against the page in light is **step 9**, which is the fill. `--faint`
 * would come out the same colour as `--primary`.
 */
const INK_FLOOR = 10;

// ── Generation ──────────────────────────────────────────────────────────────────────────────────

export interface RampRelief {
  /** The step that could not meet it; `0` for a whole-ramp obligation. */
  step: number;
  /** `Obligation.id`. */
  id: string;
  wanted: number;
  got: number;
}

/**
 * A value the seed asked for and did not get, with the rule that moved it.
 *
 * The gate policy is *adjust and publish*: a client's brand red at 2.1:1 becomes a legal red of the
 * same hue, and this is the record of that happening. Written to be read by a person on an
 * onboarding screen, which is why the OKLCH components are broken out — "darker, and slightly less
 * saturated" is a very different thing to hear than "a different colour".
 *
 * The seed determines step 9 and nothing else, so a ramp carries at most three of these, one per
 * rule that can bite.
 */
export interface Adjustment {
  /** Always 9 today — the only step a seed reaches. Kept per-step so a role table can join on it. */
  step: number;
  /** `Obligation.id` — which rule forced the move. */
  obligation: string;
  from: string;
  to: string;
  reason: string;
  deltaE: number;
  /** Signed OKLCH components of the move, so a panel can name what changed. */
  lightness: number;
  chroma: number;
  hue: number;
}

/** The net move from seed to step 9, in OKLCH. Negative chroma means colour was given up. */
export interface RampDrift {
  lightness: number;
  chroma: number;
  deltaE: number;
  /** Should always be ~0: gamut mapping spends chroma, never hue. */
  hue: number;
}

export interface Ramp {
  seed: string;
  mode: Mode;
  /** The hue every step was generated at, or `null` for a seed below `TINT_FLOOR`. */
  hue: number | null;
  /** Steps 1–12. */
  steps: string[];
  /** Steps a1–a12 as 8-digit hex: the same twelve values, as a transparency over step 1. */
  alpha: string[];
  /**
   * The ink for step 9: the ramp's own extremes first, then white or black if neither clears AA.
   *
   * The 12-step model has no slot for it. Declared rather than assumed for the reason tokens.css
   * records: on-fill text was a literal white and it failed AA on every status fill, worst at 2.13 —
   * no token meant nothing to measure.
   */
  onSolid: string;
  /**
   * The first step that reaches CONTRAST_MIN against step 1 — the one a focus ring may come from.
   *
   * Published rather than asserted, because it cannot be predicted. Measured over 118 seeds: light
   * is 9 in 97 of them and 8 in the rest, dark is 8 in 82 and 9 in the rest — `#e7000b` and
   * `#155dfc` both give 9 in dark where `#2b7fff` gives 8. A role table that hard-codes
   * `--ring: step 8` is correct for most seeds and 2.3:1 for the others. Read the field.
   */
  boundary: number;
  /**
   * The quietest step at or above `INK_FLOOR` that still reaches TEXT_MIN against step 1 — the ink
   * that is present without being content.
   *
   * Published for the same reason `boundary` is, and it was found the same way: the role table bound
   * `--faint` to a hard-coded step 10, and measured across the six documents this package ships,
   * **two of them fail AA there** — Nord in dark at 3.48:1 and Catppuccin Latte in light at 3.37:1,
   * against a bar of 4.5. `--faint` is a field's placeholder and an editor gutter's line numbers, so
   * that is unreadable placeholder text in two shipped palettes. Both land on step 11 once the step
   * is measured rather than assumed.
   *
   * It cannot fail, which is why it carries no obligation: step 12 already owes 7:1 against step 1
   * (`strong-text-on-page`), so the search always terminates at or before the end of the ramp.
   */
  quietestInk: number;
  /** What was moved to make the seed legal, itemised by the rule that moved it. */
  adjustments: Adjustment[];
  /**
   * Obligations that could not be met by moving anything.
   *
   * Only one rule can ever land here, and it is the one exception to *adjust and publish*: a seed
   * below `CHROMA_FLOOR` has no hue, and the only "adjustment" available is to invent one. That is
   * manufacturing brand out of grey — the thing `Palette.primary` exists to refuse.
   */
  relief: RampRelief[];
  drift: RampDrift;
}

/**
 * Where the ramp ends: the ink of one mode is the surface of the other, held one base increment back
 * so it never reads as a hole punched in the page.
 *
 * `SURFACE` already declares both, so the ramp needs no anchor of its own. Measured, our shipped
 * `--foreground` is L 0.269 in light and 0.970 in dark, and Radix's step 12 averages L 0.244 and
 * 0.949, against this rule's 0.167 and 0.953 for a base seed — light runs darker than either.
 */
const inkOf = (mode: Mode, base: number, direction: number) =>
  oklch(SURFACE[mode === "light" ? "dark" : "light"]).l - direction * base;

/**
 * The twelve lightnesses, from three anchors and one growth rate.
 *
 * Lower arc (1→9): eight increments in geometric progression, the first halved because 1 and 2 are
 * interchangeable. Upper arc (9→11→12): two more of the same progression, re-anchored on the ink.
 * Step 10 is not on either arc — it is one solid's hover, so it takes the fixed `SOLID_HOVER` nudge
 * and sits between 9 and 11.
 */
function lightnesses(mode: Mode, l1: number, l9: number): number[] {
  const r = GROWTH[mode];
  const direction = Math.sign(l9 - l1) || (mode === "light" ? -1 : 1);
  const span = Math.abs(l9 - l1);
  // 1/split for the halved first increment, then r^0 … r^6 for the rest.
  const base = span / (1 / FIRST_SPLIT[mode] + (r ** 7 - 1) / (r - 1));

  const out: number[] = [l1];
  let l = l1;
  for (let k = 0; k < 8; k++) {
    l += direction * (k === 0 ? base / FIRST_SPLIT[mode] : base * r ** (k - 1));
    out.push(l);
  }
  out[8] = l9; // the seed is the anchor; the progression only decides how the ramp gets there.

  const l12 = inkOf(mode, base, direction);
  // Two increments at the same ratio: d + d·r spans 9→12, and step 11 is the first of them.
  const upper = Math.abs(l12 - l9) / (1 + r);
  out.push(l9 + direction * SOLID_HOVER); // 10
  out.push(l9 + direction * upper); // 11
  out.push(l12); // 12
  return out;
}

/**
 * Step 9: the seed, made legal.
 *
 * `BAND[mode]` first — a categorical slot, a status fill and the brand all come from step 9, so a
 * step 9 outside the band would be a value the rest of the system would refuse. Then CONTRAST_MIN,
 * by walking *away from the surface* until a fill reads as a shape.
 *
 * Feasible for every seed in light, where 3:1 needs L ≤ 0.66 and the band floor is 0.43. In dark the
 * band floor of 0.48 is already 3.04:1 on `#0a0a0a`, so only the clamp ever moves anything.
 */
function solidLightness(
  mode: Mode,
  seedL: number,
  chroma: number,
  hue: number,
  surface: string,
): { l: number; banded: number | null; pulled: number | null } {
  const [lo, hi] = BAND[mode];
  const away = mode === "light" ? -1 : 1;
  const clamped = Math.min(hi - BAND_INSET, Math.max(lo + BAND_INSET, seedL));
  const banded = clamped === seedL ? null : clamped;

  let l = clamped;
  const ratio = (candidate: number) =>
    contrast(toHex(candidate, Math.min(chroma, maxChroma(candidate, hue)), hue), surface);
  if (ratio(l) >= CONTRAST_MIN) return { l, banded, pulled: null };

  // Monotone in this direction, so the first candidate that clears is the one closest to the seed —
  // the least the seed has to give up.
  let far = away < 0 ? lo + BAND_INSET : hi - BAND_INSET;
  if (ratio(far) < CONTRAST_MIN) return { l: far, banded, pulled: far }; // `visible-fill` will say so
  for (let i = 0; i < 24; i++) {
    const mid = (l + far) / 2;
    if (ratio(mid) >= CONTRAST_MIN) far = mid;
    else l = mid;
  }
  return { l: far, banded, pulled: far };
}

/**
 * A seed and a mode in; twelve steps and an honest account of what could not be met, out.
 *
 * Light and dark are separate generations and never an inversion: `BAND` differs per mode and a
 * flipped light value lands outside the dark band, and the growth rate, the chroma profile and the
 * ink anchor are all per mode too.
 */
export function deriveRamp(seed: string, mode: Mode): Ramp {
  const { l: seedL, c: seedC, h: seedH } = oklch(seed);
  // Only the noise regime flattens. Whether the seed also carries identity is a separate question
  // with a separate answer — `CHROMA_FLOOR`, reported as relief.
  const tinted = seedC >= TINT_FLOOR;
  const hue = tinted ? seedH : 0;

  const seedChroma = tinted ? seedC : 0;
  const l1 = oklch(SURFACE[mode]).l;

  /**
   * Run twice, because every obligation is measured against **step 1** and step 1 is not the
   * surface: it is the surface carrying 2.4% of the seed's chroma, and that tint costs real
   * luminance — an orange step 1 measures 0.949 against `#fafafa`'s 0.958. Solving step 9 against
   * the surface and then grading it against step 1 put five seeds at 2.995:1, failing a 3:1 rule by
   * a rounding error. The first pass exists only to learn what the background will be.
   */
  const build = (surface: string) => {
    const solved = solidLightness(mode, seedL, seedChroma, hue, surface);
    const c9 = Math.min(seedChroma, maxChroma(solved.l, hue));
    return {
      solved,
      steps: lightnesses(mode, l1, solved.l).map((l, i) => toHex(l, tintedChroma(mode, i, c9), hue)),
    };
  };
  const { solved, steps } = build(build(SURFACE[mode]).steps[0] as string);
  const alpha = steps.map((hex) => alphaOver(hex, steps[0] as string));

  // `from` is where the value stood when the rule fired, so the chain reads as a story rather than
  // as three independent claims about the same colour.
  const adjustments: Adjustment[] = [];
  let standing = seed;
  const say = (obligation: string, to: string, reason: string) => {
    if (to === standing) return;
    const a = oklch(standing);
    const b = oklch(to);
    adjustments.push({
      step: 9,
      obligation,
      from: standing,
      to,
      reason,
      deltaE: deltaE(standing, to),
      lightness: b.l - a.l,
      chroma: b.c - a.c,
      hue: a.c < CHROMA_FLOOR || b.c < CHROMA_FLOOR ? 0 : hueDistance(b.h, a.h),
    });
    standing = to;
  };
  say(
    "carries-identity",
    tinted ? standing : toHex(seedL, 0, 0),
    `Saturation is so low that the hue is float error in the encoding rather than a colour, so only ` +
      `lightness could be kept. A deliberate tint survives this; noise does not.`,
  );
  say(
    "in-band",
    solved.banded === null ? standing : toHex(solved.banded, seedChroma, hue),
    `Moved into the ${mode} lightness band, which is the range a fill, a chart slot and the brand ` +
      `already answer to in this system — outside it the rest of the checks would refuse the value.`,
  );
  say(
    "visible-fill",
    solved.pulled === null ? standing : toHex(solved.pulled, seedChroma, hue),
    `Moved away from the page until the fill reads as a shape at ${CONTRAST_MIN}:1. A solid below ` +
      `that is barely visible as an object, which is what WCAG asks of a non-text element.`,
  );
  say(
    "gamut",
    steps[8] as string,
    `Saturation reduced to what sRGB can display at that lightness. The hue is unchanged — a screen ` +
      `cannot show the colour that was asked for, and rotating the hue to fake it would be worse.`,
  );

  const solid = steps[8] as string;
  const own = [steps[0] as string, steps[11] as string].sort(
    (a, b) => contrast(b, solid) - contrast(a, solid),
  );
  const best = own[0] as string;
  const onSolid =
    contrast(best, solid) >= TEXT_MIN
      ? best
      : ([...ACHROMATIC].sort((a, b) => contrast(b, solid) - contrast(a, solid))[0] as string);

  const boundary =
    steps.findIndex((hex) => contrast(hex, steps[0] as string) >= CONTRAST_MIN) + 1 || RAMP_LENGTH + 1;

  // Searched from `INK_FLOOR`, never from 1: the first AA step is the FILL on most ramps. Cannot
  // miss — step 12 owes 7:1 by `strong-text-on-page`.
  const quietestInk =
    steps.findIndex(
      (hex, i) => i + 1 >= INK_FLOOR && contrast(hex, steps[0] as string) >= TEXT_MIN,
    ) + 1 || RAMP_LENGTH;

  const measured = oklch(solid);
  return {
    seed,
    mode,
    hue: tinted ? seedH : null,
    steps,
    alpha,
    onSolid,
    boundary,
    quietestInk,
    adjustments,
    relief: checkRamp(steps, mode, onSolid, alpha),
    drift: {
      lightness: measured.l - seedL,
      chroma: measured.c - seedC,
      deltaE: deltaE(solid, seed),
      hue: tinted ? hueDistance(measured.h, seedH) : 0,
    },
  };
}

// ── The check ───────────────────────────────────────────────────────────────────────────────────

/**
 * Re-measure every obligation against the values that were actually produced.
 *
 * Separate from `deriveRamp` and reading only hexes: a gate that shares the generator's arithmetic
 * cannot catch the generator being wrong. Everything here is measured off the rounded 8-bit values a
 * browser will see, not off the floats they came from.
 */
export function checkRamp(
  steps: readonly string[],
  mode: Mode,
  onSolid?: string,
  alpha?: readonly string[],
): RampRelief[] {
  const relief: RampRelief[] = [];
  const at = (n: number) => steps[n - 1] as string;
  const fail = (step: number, id: string, wanted: number, got: number) =>
    relief.push({ step, id, wanted, got });

  if (steps.length !== RAMP_LENGTH) {
    fail(0, "monotone", RAMP_LENGTH, steps.length);
    return relief;
  }

  const surface = contrast(at(1), SURFACE[mode]);
  if (surface > 1.05) fail(1, "surface", 1.05, surface);

  const near = deltaE(at(1), at(2));
  if (near < DISTINCT) fail(2, "interchangeable", DISTINCT, near);
  if (near > INTERCHANGEABLE) fail(2, "interchangeable", INTERCHANGEABLE, near);

  for (const step of [4, 5] as const) {
    const gap = deltaE(at(step - 1), at(step));
    if (gap < PERCEPTIBLE) fail(step, step === 4 ? "hover" : "active", PERCEPTIBLE, gap);
  }

  const surfaceTop = contrast(at(5), at(1));
  if (surfaceTop >= CONTRAST_MIN) fail(5, "still-a-surface", CONTRAST_MIN, surfaceTop);

  // Not "step 8 clears 3:1" — that is false in light for every seed and true in dark for every seed,
  // so asserting it would fail 18 good ramps and catch nothing.
  const boundary = steps.findIndex((hex) => contrast(hex, at(1)) >= CONTRAST_MIN) + 1;
  if (boundary < 1 || boundary > 9) fail(0, "control-boundary", 9, boundary || RAMP_LENGTH + 1);

  const fill = contrast(at(9), at(1));
  if (fill < CONTRAST_MIN) fail(9, "visible-fill", CONTRAST_MIN, fill);

  const { l: l9, c: c9 } = oklch(at(9));
  const [lo, hi] = BAND[mode];
  if (l9 < lo || l9 > hi) fail(9, "in-band", l9 < lo ? lo : hi, l9);
  if (c9 < CHROMA_FLOOR) fail(9, "carries-identity", CHROMA_FLOOR, c9);

  const hover = deltaE(at(9), at(10));
  if (hover < PERCEPTIBLE) fail(10, "solid-hover", PERCEPTIBLE, hover);
  const hoverFill = contrast(at(10), at(1));
  if (hoverFill < CONTRAST_MIN) fail(10, "solid-hover", CONTRAST_MIN, hoverFill);

  for (const [step, id, bar] of [
    [11, "text-on-page", TEXT_MIN],
    [12, "strong-text-on-page", STRONG_TEXT],
  ] as const) {
    const ratio = contrast(at(step), at(1));
    if (ratio < bar) fail(step, id, bar, ratio);
  }
  for (const [step, id] of [
    [11, "text-on-fill"],
    [12, "strong-text-on-fill"],
  ] as const) {
    const ratio = contrast(at(step), at(5));
    if (ratio < TEXT_MIN) fail(step, id, TEXT_MIN, ratio);
  }

  // Step 10 is deliberately skipped — it is the solid's hover, so it sits between 9 and 11 and is
  // covered by `solid-hover` instead.
  const path = [...steps.slice(0, 9), at(11), at(12)].map((hex) => oklch(hex).l);
  const direction = Math.sign((path[10] as number) - (path[0] as number));
  for (let i = 1; i < path.length; i++) {
    const delta = ((path[i] as number) - (path[i - 1] as number)) * direction;
    if (delta <= 0) fail(i + 1, "monotone", 0, delta);
  }

  // Graded as a distance, not as an angle. Filtering by chroma and comparing degrees graded 75 of
  // 204 steps on the chromatic ramps and **0 of 96** on the tinted ones, where every step is under
  // `CHROMA_FLOOR` by construction. The angle is also the wrong quantity: a tinted step 1 at c
  // 0.0017 can sit 30° off and still be the right colour, because what a person sees is the
  // perpendicular offset in a/b, and 30° of a chroma that small is ΔE 0.06.
  //
  // `c·sin(Δh)` is that offset, defined at every step including a pure grey's. The bound is
  // `HUE_TOLERANCE` re-expressed through the chroma at which a hue starts doing identity work — 3°
  // at `CHROMA_FLOOR` is ΔE 0.52. Measured across every seed in both modes the worst offset is 0.25,
  // so this passes with headroom while grading 300 of 300 steps.
  const drift = steps.map((hex) => oklch(hex));
  const anchor = drift[8] as { c: number; h: number };
  if (anchor.c >= TINT_FLOOR) {
    for (let i = 0; i < drift.length; i++) {
      const o = drift[i] as { c: number; h: number };
      const off = 100 * o.c * Math.sin((hueDistance(o.h, anchor.h) * Math.PI) / 180);
      if (off > HUE_OFFSET) fail(i + 1, "hue-held", HUE_OFFSET, off);
    }
  }

  if (onSolid !== undefined) {
    const ink = contrast(onSolid, at(9));
    if (ink < TEXT_MIN) fail(0, "on-solid", TEXT_MIN, ink);
  }

  if (alpha !== undefined) {
    for (let i = 0; i < Math.min(alpha.length, RAMP_LENGTH); i++) {
      const gap = deltaE(over(alpha[i] as string, at(1)), steps[i] as string);
      if (gap > ALPHA_TOLERANCE) fail(i + 1, "alpha-fidelity", ALPHA_TOLERANCE, gap);
    }
    if (alpha.length !== RAMP_LENGTH) fail(0, "alpha-fidelity", RAMP_LENGTH, alpha.length);
  }

  return relief;
}
