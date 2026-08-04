/**
 * The categorical-palette checks, as executable specification.
 *
 * These live in the domain rather than in a document because a rule nothing runs is not a rule.
 * `--chart-*` shipped broken for as long as it did precisely because no code could answer "is this
 * palette legal?" — two of its light slots were the same colour to full-colour vision and one was
 * below the chroma floor, and nothing said so. Now the registry has a gate.
 *
 * Pure: no DOM, no React, no CSS. Colour in, verdict out.
 *
 * `checkScheme` measures five — `band`, `chroma`, `cvd`, `normal`, `relief`, the five fields of
 * `SchemeReport`. Two more are structural and cannot be measured from hexes: that the hue anchors
 * are fixed, and that every value comes from a documented palette. They are enforced by where the
 * values are allowed to come from, not here.
 */

/** OKLCH lightness band per mode. Outside it a slot is too pale or too dark for its surface. */
export const BAND = { light: [0.43, 0.77], dark: [0.48, 0.67] } as const;
/** OKLCH chroma below which a hue stops doing identity work and reads as grey. */
export const CHROMA_FLOOR = 0.1;
/**
 * ΔE is Euclidean distance in OKLab ×100.
 *
 * These are calibrated to the Machado–Oliveira–Fernandes (2009) severity-1.0 simulation below: the
 * simulation model is part of the standard, not an implementation detail. Swapping in another one
 * moves borderline pairs and would require recalibrating the numbers.
 */
export const CVD_TARGET = 8;
export const CVD_FLOOR = 6;
/** Worst pair under *unsimulated* vision. A hard gate — secondary encoding does not excuse it. */
export const NORMAL_FLOOR = 15;
/** WCAG ratio against the surface. Sub-3:1 is a documented relax, not a pass. */
export const CONTRAST_MIN = 3;
/**
 * WCAG AA for small text.
 *
 * The bar for a *palette* slot rather than a chart slot. `CONTRAST_MIN` is 3 because a mark is not
 * text and can buy the difference back with a relief channel — direct labels, a table view. Every
 * base16 slot is rendered as text, so it has neither the excuse nor the remedy.
 */
export const TEXT_MIN = 4.5;

/**
 * The surfaces a mark actually lands on.
 *
 * Contrast and band results are only meaningful against the real surface, and the real surface is
 * the tenant's own neutral step 1 rather than these two literals. It never moves far: `ramp.ts`'s
 * `surface` obligation holds step 1 within 1.05:1 of the value here, so a margin measured against
 * these holds for every tenant.
 */
export const SURFACE = { light: "#fafafa", dark: "#0a0a0a" } as const;

export type Mode = keyof typeof BAND;
export type CvdKind = "protan" | "deutan" | "tritan";

const MACHADO: Record<CvdKind, number[][]> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

const srgb = (hex: string): number[] => {
  const h = hex.trim().replace(/^#/, "");
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255);
};
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linear = (hex: string) => srgb(hex).map(toLinear);

function oklabOf([r = 0, g = 0, b = 0]: number[]): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/**
 * OKLCH lightness, chroma and hue.
 *
 * Hue is not used by any of `checkScheme`'s five — they ask how far apart colours are, not where on
 * the wheel they sit. It is here for the job on the other side: translating a foreign palette. Matching
 * a borrowed colour to one of the system's hue families has to compare *hue*, because `deltaE`
 * includes lightness, and a pastel palette is uniformly light enough that lightness dominates the
 * distance — matching Dracula's accents by `deltaE` answers `purple→sky` and `green→yellow`, which
 * are not neighbourhoods of anything.
 *
 * Hue is always computed and is **meaningless below the chroma floor** — `#737373` answers 89.9°,
 * which is float noise in `a`/`b`, not a colour. Callers gate on `c`; reporting a fabricated `0`
 * would look like an answer instead of an absence.
 */
export function oklch(hex: string): { l: number; c: number; h: number } {
  const [l, a, b] = oklabOf(linear(hex));
  const c = Math.hypot(a, b);
  return { l, c, h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
}

/** Shortest angular distance between two hues, in degrees (0–180). */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** WCAG contrast ratio between two colours, order-independent. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r = 0, g = 0, bl = 0] = linear(hex);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const simulate = (hex: string, kind: CvdKind) => {
  const [r = 0, g = 0, b = 0] = linear(hex);
  const m = MACHADO[kind];
  return (m as number[][]).map((row) =>
    Math.max(0, Math.min(1, (row[0] as number) * r + (row[1] as number) * g + (row[2] as number) * b)),
  );
};

/** OKLab distance ×100. Without `kind`, unsimulated vision. */
export function deltaE(a: string, b: string, kind?: CvdKind): number {
  const x = oklabOf(kind ? simulate(a, kind) : linear(a));
  const y = oklabOf(kind ? simulate(b, kind) : linear(b));
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

export interface WorstPair {
  delta: number;
  pair: [string, string];
}

export interface SchemeReport {
  /** No hard failure. Relief and the CVD floor band are warnings, not failures. */
  ok: boolean;
  /** Slots outside the mode's lightness band. */
  band: string[];
  /** Slots below the chroma floor — they read as grey. */
  chroma: string[];
  /** Worst pair under protanopia/deuteranopia, and how it lands against target and floor. */
  cvd: WorstPair & { kind: CvdKind; state: "pass" | "floor" | "fail" };
  /** Worst pair under unsimulated vision. */
  normal: WorstPair & { ok: boolean };
  /** Slots below 3:1 on the surface. Non-empty obliges a relief channel, it does not fail. */
  relief: string[];
}

/**
 * Which pairs have to stay apart.
 *
 * `adjacent` is right for stacks, bars and lines, where only neighbours touch. `all` is right for
 * scatter, bubble, choropleth and the graph canvas, where any two marks can end up side by side —
 * and it is a strictly harder test that caps how many series those forms can carry.
 */
export type PairList = "adjacent" | "all";

const pairsOf = (n: number, list: PairList): [number, number][] =>
  list === "all"
    ? Array.from({ length: n }, (_, i) => Array.from({ length: n - i - 1 }, (_, k) => [i, i + 1 + k] as [number, number])).flat()
    : Array.from({ length: Math.max(0, n - 1) }, (_, i) => [i, i + 1] as [number, number]);

export function checkScheme(
  colours: readonly string[],
  options: { mode: Mode; surface?: string; pairs?: PairList },
): SchemeReport {
  const { mode, surface = SURFACE[mode], pairs = "adjacent" } = options;
  const [lo, hi] = BAND[mode];

  const band = colours.filter((hex) => {
    const { l } = oklch(hex);
    return l < lo || l > hi;
  });
  const chroma = colours.filter((hex) => oklch(hex).c < CHROMA_FLOOR);
  const relief = colours.filter((hex) => contrast(hex, surface) < CONTRAST_MIN);

  const list = pairsOf(colours.length, pairs);
  const worst = (kind?: CvdKind): WorstPair & { kind: CvdKind } => {
    let best: WorstPair & { kind: CvdKind } = {
      delta: Number.POSITIVE_INFINITY,
      pair: ["", ""],
      kind: kind ?? "deutan",
    };
    for (const [i, j] of list) {
      const a = colours[i] as string;
      const b = colours[j] as string;
      const delta = deltaE(a, b, kind);
      if (delta < best.delta) best = { delta, pair: [a, b], kind: kind ?? "deutan" };
    }
    return best;
  };

  // The CVD verdict is the worse of protan and deutan. `deltaE` will simulate `tritan` and nothing
  // in this package asks it to: tritan is rare enough that `CVD_TARGET`/`CVD_FLOOR` were never
  // calibrated against it, so the number would arrive with no bar to read it against.
  const protan = worst("protan");
  const deutan = worst("deutan");
  const cvdWorst = protan.delta <= deutan.delta ? protan : deutan;
  const state = cvdWorst.delta >= CVD_TARGET ? "pass" : cvdWorst.delta >= CVD_FLOOR ? "floor" : "fail";
  const normalWorst = worst();

  return {
    // `colours.length >= 2` is not pedantry. With fewer, `pairsOf` is empty, both worst-pair
    // searches return `Infinity`, and every separation check passes vacuously — so Nord, whose
    // eight accents leave exactly one above the chroma floor, reported a *passing scheme*. One
    // colour is not a categorical palette; there are no categories to tell apart.
    ok:
      colours.length >= 2 &&
      !band.length &&
      !chroma.length &&
      state !== "fail" &&
      normalWorst.delta >= NORMAL_FLOOR,
    band,
    chroma,
    cvd: { ...cvdWorst, state },
    normal: { ...normalWorst, ok: normalWorst.delta >= NORMAL_FLOOR },
    relief,
  };
}
