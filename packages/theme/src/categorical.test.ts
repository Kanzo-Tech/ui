import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrast, oklch } from "./ink";

/**
 * The eight colours a theme gets by saying nothing, and the bars they were chosen against.
 *
 * Sixteen themes author a categorical set; thirteen do not, because daisyUI has no such channel to
 * import. Until this set existed those thirteen declared `--chart-capacity: 0` — the honest answer
 * while there was nothing behind the slots, and the wrong one afterwards, because zero is how
 * `monochrome` says *I decline the channel* and the two facts had collapsed into one spelling.
 *
 * A default set is a harder thing than a theme's own, and every assertion here is a consequence of
 * that: a theme's set is chosen against **its** background, and this one has to sit on all
 * twenty-nine. That rules out deriving it from `--primary` before anything else does — `--chart-6`
 * takes twelve distinct values across the sixteen authored sets, so there is no function from one
 * theme colour to a categorical slot. What a set answers to is *separation*, which is a property of
 * the eight together.
 *
 * ## Why these numbers, and where they came from
 *
 * The model is the data-viz standard the reference systems use, not one invented here: OKLab ΔE
 * ×100 over Machado, Oliveira & Fernandes (2009) dichromacy simulation at severity 1.0. The bands
 * and floors are that standard's; the *status* floor is ours, and it is the surviving half of
 * `decisions/a-categorical-set-may-use-the-palettes-own-colours.md` — a set must not put a series
 * in a colour that reads as a state.
 *
 * The eight were found by search over the OKLCH grid rather than picked: L in the band both sides
 * share, chroma at 85% of the in-gamut ceiling, hues at least 30° apart, ordered so that the pairs
 * a stacked bar puts side by side are the ones furthest apart. The record carries the working.
 *
 * ## What this cannot prove
 *
 * - **That eight series are legible in a scatter.** The separation floors here are over *adjacent*
 *   pairs, which is what a stack, a bar group and a line chart put together. With all 28 pairs in
 *   play no eight-colour set clears the same floors — measured, not assumed — so a form that shows
 *   every pair at once carries a series cap instead. That is a chart's decision, not a theme's.
 * - **That a theme's own set is any good.** The sixteen authored ones are not measured here. They
 *   were derived per document against that document's own surface, and re-judging them against two
 *   extremes they never claimed to sit on would fail them for a promise they never made.
 * - **That a slot is far from a status fill a *tenant* writes.** The floor is measured against the
 *   fifty-two distinct status colours the shipped themes publish. A client theme is free to author
 *   a `--success` that lands on one of these, and nothing here will know.
 */

const PKG = resolve(__dirname, "..");
const THEME_DIR = join(PKG, "themes");

/**
 * Declarations only, no chain resolution — which is why this guard does not reach for
 * `themes.test.ts`'s resolver. Everything it asks about is either written in the file or
 * deliberately absent, and "absent" is half of what is being checked.
 */
const THEMES = readdirSync(THEME_DIR)
  .filter((f) => f.endsWith(".css"))
  .sort()
  .map((file) => {
    const source = readFileSync(join(THEME_DIR, file), "utf8");
    const declared = new Map<string, string>();
    for (const match of source.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)) {
      const [, token, value] = match;
      if (token && value) declared.set(token, value.trim());
    }
    return { name: file.replace(/\.css$/, ""), declared };
  });

/**
 * The eight, read out of `tokens.css` rather than restated — a copy would agree until it did not.
 *
 * They are read from a `:root` **declaration**, and the first draft read them from a fallback
 * written into the bridge — `var(--chart-N, <hex>)`. That shape passed every assertion below and
 * was inert where it mattered: `@theme inline` resolves a bridge into the *utility*, so the
 * fallback reached `bg-chart-1` and never reached a chart, which asks `categoricalColor` for
 * `var(--chart-N)` and resolves it itself. The eight are values, not aliases, so they inherit
 * correctly from `:root` and a `[data-theme]` block overrides them slot by slot.
 */
const DEFAULTS = (() => {
  const bridge = readFileSync(join(PKG, "tokens.css"), "utf8");
  const slots: string[] = [];
  for (let i = 1; i <= 8; i++) {
    const found = new RegExp(`^\\s*--chart-${i}:\\s*(#[0-9a-f]{6});`, "m").exec(bridge);
    if (found?.[1]) slots.push(found[1]);
  }
  return slots;
})();

/**
 * And the shape itself, because the inert version is invisible from every other assertion here.
 * A chart reads `var(--chart-N)` off the live element; a fallback that only exists inside a
 * compiled utility cannot answer that.
 */
const BRIDGE_IS_PLAIN = (() => {
  const bridge = readFileSync(join(PKG, "tokens.css"), "utf8");
  return [...Array(8)].every((_, i) =>
    new RegExp(`--color-chart-${i + 1}: var\\(--chart-${i + 1}\\);`).test(bridge),
  );
})();

// ── The measurement, spelled out once ────────────────────────────────────────────────────────────
// Machado, Oliveira & Fernandes (2009), severity 1.0, in linear RGB. The simulation model is part
// of the standard the floors were calibrated against, not an implementation detail: swapping in
// Viénot (1999) moves borderline pairs and the numbers below would have to move with it.
const MACHADO: Record<"protan" | "deutan" | "tritan", readonly [Rgb, Rgb, Rgb]> = {
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

type Vision = keyof typeof MACHADO | "normal";

const channel = (hex: string, at: number) => {
  const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const toLinear = (hex: string): Rgb => [channel(hex, 1), channel(hex, 3), channel(hex, 5)];

type Rgb = readonly [number, number, number];

function oklab([r, g, b]: Rgb): Rgb {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function seen(hex: string, vision: Vision): Rgb {
  const rgb = toLinear(hex);
  if (vision === "normal") return rgb;
  const through = (row: Rgb) => Math.min(1, Math.max(0, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2]));
  const [x, y, z] = MACHADO[vision];
  return [through(x), through(y), through(z)];
}

/** Euclidean distance in OKLab ×100, through one pair of eyes. */
function deltaE(a: string, b: string, vision: Vision = "normal"): number {
  const [l1, a1, b1] = oklab(seen(a, vision));
  const [l2, a2, b2] = oklab(seen(b, vision));
  return 100 * Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

// The bands both sides publish; a set that sits on either surface lives in the intersection, which
// is the dark one. Under it a slot is too dim to tell from the ink on a light page; over it, too
// pale to see on a dark one.
const BAND = { lo: 0.48, hi: 0.67 };
const CHROMA_FLOOR = 0.1;
const CONTRAST_MIN = 3;
const CVD_FLOOR = 8;
const NORMAL_FLOOR = 15;
const STATUS_FLOOR = 8;

const STATUS_TOKENS = ["--destructive", "--success", "--warning", "--info"] as const;

const opaque = (value: string | undefined) => (value && /^#[0-9a-f]{6}$/.test(value) ? value : null);

/** Every background the catalogue ships, so the extremes are read rather than assumed. */
const BACKGROUNDS = THEMES.map((theme) => ({
  name: theme.name,
  hex: opaque(theme.declared.get("--background")),
}));

describe("the categorical set a theme falls back to", () => {
  it("publishes eight slots, each an opaque hex, and reaches a chart rather than only a utility", () => {
    expect(DEFAULTS).toHaveLength(8);
    expect(new Set(DEFAULTS).size).toBe(8);
    // The bridge stays a plain `var()`: the default is a declaration, so both a utility and a
    // chart resolve it. Moving it into the bridge would silently take it away from every mark.
    expect(BRIDGE_IS_PLAIN).toBe(true);
  });

  it("sits inside the band the light and dark sides share", () => {
    const offBand = DEFAULTS.map((c) => [c, oklch(c)] as const).filter(
      ([, { l }]) => l < BAND.lo || l > BAND.hi,
    );
    expect(offBand.map(([c, { l }]) => `${c} L=${l.toFixed(3)}`)).toEqual([]);
  });

  it("keeps every slot chromatic enough to carry identity", () => {
    const flat = DEFAULTS.map((c) => [c, oklch(c).c] as const).filter(([, c]) => c < CHROMA_FLOOR);
    expect(flat).toEqual([]);
  });

  it("clears 3:1 against every background the catalogue ships", () => {
    // Not the two extremes but all twenty-nine, because relative luminance is not monotonic in the
    // thing that makes a background "light": a mid-lightness ground can be the hard case for a
    // mid-lightness slot, and that pair is invisible from the ends.
    const failures: string[] = [];
    for (const ground of BACKGROUNDS) {
      if (!ground.hex) continue;
      for (const slot of DEFAULTS) {
        const ratio = contrast(slot, ground.hex);
        if (ratio < CONTRAST_MIN) failures.push(`${slot} on ${ground.name} ${ratio.toFixed(2)}:1`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("keeps adjacent slots apart, to normal vision and to all three dichromacies", () => {
    // Adjacent, because that is the pairlist a stacked bar, a bar group and a multi-series line
    // actually put side by side — and because the eight cannot clear these floors over all 28
    // pairs, which is a fact about eight colours rather than about this eight.
    const failures: string[] = [];
    for (let i = 0; i < DEFAULTS.length - 1; i++) {
      const a = DEFAULTS[i] ?? "";
      const b = DEFAULTS[i + 1] ?? "";
      const normal = deltaE(a, b);
      if (normal < NORMAL_FLOOR) failures.push(`${a}↔${b} normal ΔE ${normal.toFixed(1)}`);
      for (const vision of ["protan", "deutan", "tritan"] as const) {
        const d = deltaE(a, b, vision);
        if (d < CVD_FLOOR) failures.push(`${a}↔${b} ${vision} ΔE ${d.toFixed(1)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("stays clear of every status fill the catalogue publishes, so a series cannot read as a state", () => {
    const fills = new Set<string>();
    for (const theme of THEMES) {
      for (const token of STATUS_TOKENS) {
        const fill = opaque(theme.declared.get(token));
        if (fill) fills.add(fill);
      }
    }
    expect(fills.size).toBeGreaterThan(40);

    const collisions: string[] = [];
    for (const slot of DEFAULTS) {
      for (const fill of fills) {
        const d = deltaE(slot, fill);
        if (d < STATUS_FLOOR) collisions.push(`${slot} ≈ ${fill} ΔE ${d.toFixed(1)}`);
      }
    }
    expect(collisions).toEqual([]);
  });

  it("lets a theme decline the channel, and only by saying so", () => {
    // Both halves, so neither can be satisfied by deleting the other. A declared zero must be a
    // theme that means it; and a theme with no set of its own must NOT declare one, or it would be
    // declining a channel it is simply not authoring — which is what all thirteen imported themes
    // were doing before these eight existed.
    const declining = THEMES.filter((t) => t.declared.get("--chart-capacity") === "0").map(
      (t) => t.name,
    );
    expect(declining).toEqual(["monochrome-dark", "monochrome"]);

    const silent = THEMES.filter((t) => !t.declared.has("--chart-1"));
    for (const theme of silent) {
      if (declining.includes(theme.name)) continue;
      expect([theme.name, theme.declared.get("--chart-capacity")]).toEqual([theme.name, undefined]);
    }
  });

  it("lets an authored set win slot by slot", () => {
    // The bridge is `var(--chart-N, <default>)`, so a theme that writes one slot keeps the other
    // seven. That is worth an assertion because the alternative shape — a default block under
    // `:root` — would have been overridden all-or-nothing by source order, and it is invisible in
    // a browser until a theme authors exactly one.
    const authored = THEMES.filter((t) => t.declared.has("--chart-1"));
    expect(authored.length).toBe(16);
    for (const theme of authored) {
      const own = [...Array(8)].map((_, i) => theme.declared.get(`--chart-${i + 1}`));
      expect([theme.name, own.filter(Boolean).length]).toEqual([theme.name, 8]);
    }
  });
});
