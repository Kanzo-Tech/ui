import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AA, contrast, hex, inkFor, oklch, pageInk } from "./ink";

/**
 * What the rule owes, and what it cannot be asked for.
 *
 * The claim in `ink.ts` is two-sided — *it is daisyUI's formula* and *it always clears AA* — and
 * either half alone is easy. A rule that always returned black clears AA on most fills and is not
 * daisyUI's; a rule that copies the formula is daisyUI's and fails AA on 11% of the gamut. So both
 * are asserted here, and the second is asserted over a sweep rather than over examples: a
 * threshold rule fails in a *band*, and a fixture of hand-picked fills is exactly the shape of test
 * that misses a band.
 *
 * ## What these cannot prove
 *
 * - **That any pair looks good.** AA is a floor on legibility. Nothing here has an opinion about
 *   whether a fill and its ink belong in the same theme.
 * - **That the fixture is daisyUI's intent.** It is daisyUI's *output*, converted from OKLCh to
 *   hex, so a pair a person adjusted by hand reads here as if the formula had produced it. The
 *   fixture is filtered to pairs whose ink carries the fill's hue exactly — which is the formula's
 *   signature — but a hand adjustment that kept the hue is indistinguishable and will be in there.
 * - **Anything about the fill.** Whether the fill itself reads against the surface it sits on is a
 *   different pair, measured by `status.test.ts` over the themes that ship.
 */

/**
 * Fills and inks from daisyUI 5.7.20 (MIT), one per theme, converted from OKLCh to hex.
 *
 * Filtered three ways, and each filter is part of the claim rather than a way to pass: the fill
 * carries real chroma (below ~0.05 there is no hue to carry and the next filter admits anything),
 * the ink repeats the fill's hue to four decimals (the formula's signature), and the pair clears
 * AA (we only claim to reproduce the ones daisyUI got right). What that leaves out is the interesting
 * part — 40 of daisyUI's 280 pairs fail AA, and on those {@link inkFor} deliberately returns
 * something else.
 */
const DAISY: ReadonlyArray<readonly [string, string, string]> = [
  ["abyss/primary", "#bdff00", "#427600"],
  ["acid/primary", "#ff00ff", "#180017"],
  ["aqua/accent", "#ffe999", "#161309"],
  ["autumn/primary", "#8c0327", "#edd0d0"],
  ["black/info", "#0000ff", "#c6dbff"],
  ["business/primary", "#1c4e80", "#d0dae5"],
  ["cmyk/primary", "#45aeee", "#020b13"],
  ["coffee/primary", "#db924c", "#110802"],
  ["cyberpunk/primary", "#ff6596", "#180408"],
  ["dim/primary", "#9fe88d", "#091307"],
  ["dracula/primary", "#ff79c6", "#16050e"],
  ["fantasy/primary", "#6d0076", "#e3cee4"],
  ["forest/secondary", "#1eb88e", "#000c07"],
  ["garden/secondary", "#8e4162", "#ead7de"],
  ["halloween/secondary", "#7a00c2", "#e3d4f6"],
  ["lemonade/primary", "#419400", "#010800"],
  ["lofi/info", "#5fcfdd", "#031011"],
  ["luxury/secondary", "#152747", "#cbd0d7"],
  ["night/primary", "#3abdf7", "#010d15"],
  ["nord/primary", "#5e81ac", "#03060b"],
  ["silk/info", "#78c8ff", "#003162"],
  ["sunset/primary", "#ff865b", "#160603"],
  ["winter/secondary", "#463aa2", "#d5d7ee"],
] as const;

/** Every in-gamut fill on a 2%/0.02/15° lattice — the sweep the band-shaped failure needs. */
function gamut(): string[] {
  const fills: string[] = [];
  for (let l = 2; l <= 98; l += 2) {
    for (let c = 0; c <= 0.32; c += 0.02) {
      for (let h = 0; h < 360; h += 15) {
        const fill = hex({ l: l / 100, c, h });
        const back = oklch(fill);
        // Clamping put it somewhere else, so it is not a fill at these coordinates. Drop it rather
        // than measure the rule against a colour sRGB cannot hold.
        if (Math.abs(back.l - l / 100) > 0.02 || Math.abs(back.c - c) > 0.02) continue;
        fills.push(fill);
      }
    }
  }
  return fills;
}

const deltaE = (a: string, b: string) => {
  const [x, y] = [oklch(a), oklch(b)];
  const rad = (v: { c: number; h: number }) => (v.h * Math.PI) / 180;
  const ax = x.c * Math.cos(rad(x));
  const bx = x.c * Math.sin(rad(x));
  const ay = y.c * Math.cos(rad(y));
  const by = y.c * Math.sin(rad(y));
  return Math.hypot(x.l - y.l, ax - ay, bx - by) * 100;
};

describe("the colour maths", () => {
  it("round-trips a hex through OKLCh", () => {
    for (const value of ["#e7000b", "#155dfc", "#fafafa", "#0f0f0f", "#009966", "#7f7f7f"]) {
      expect(hex(oklch(value))).toBe(value);
    }
  });

  it("agrees with the WCAG anchors", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    // Order is not part of the question.
    expect(contrast("#767676", "#ffffff")).toBeCloseTo(contrast("#ffffff", "#767676"), 10);
  });
});

describe("inkFor", () => {
  const fills = gamut();

  it("sweeps a real span of the gamut", () => {
    // Guards the guard: a lattice that silently collapsed would make every assertion below vacuous.
    expect(fills.length).toBeGreaterThan(8000);
  });

  it("never returns an ink below AA", () => {
    const short = fills
      .map((fill) => ({ fill, ink: inkFor(fill), ratio: contrast(fill, inkFor(fill)) }))
      .filter((r) => r.ratio < AA);
    expect(short).toEqual([]);
  });

  it("is stable — the same fill gives the same ink", () => {
    for (const fill of fills.slice(0, 200)) expect(inkFor(fill)).toBe(inkFor(fill));
  });

  it("spends chroma and never gains it", () => {
    // The claim the docblock makes is stronger than this — chroma at a fifth — and this is
    // deliberately the weaker one, because the stronger cannot be read back off a hex. OKLab takes
    // a cube root, so near the ends of the cube an 8-bit step is a large excursion in the space:
    // `#000001` computes as chroma 0.021, more than plenty of real fills, while being
    // indistinguishable from black. An ink is by construction pushed toward exactly those ends, so
    // measuring its chroma against `fill.c * 0.2` measures the rounding. What survives that and
    // still says something is the direction: an ink is a *drained* version of its fill, never a
    // more saturated one. The fifth itself is pinned by the daisyUI comparison below, which
    // compares whole values rather than a component.
    const gained = fills.filter((fill) => oklch(inkFor(fill)).c > oklch(fill).c + 0.005);
    expect(gained).toEqual([]);
  });

  it("carries the fill's hue wherever the angle still means something", () => {
    // Bounded at 4°, and the bound is quantisation rather than the rule: an ink is by construction
    // low in chroma, so at 8 bits per channel its hue angle is coarse — below ~0.05 chroma a
    // one-unit rounding swings it tens of degrees while the colour is indistinguishable. Measured
    // over the sweep, the drift is 0.45° median and 3.54° worst above that floor, and it climbs to
    // 33° below it purely as arithmetic. The other source is gamut clamping, which the `hex`
    // docblock owns.
    const drifted = fills.filter((fill) => {
      const [a, b] = [oklch(fill), oklch(inkFor(fill))];
      if (a.c < 0.02 || b.c < 0.05) return false;
      const gap = Math.abs(a.h - b.h);
      return Math.min(gap, 360 - gap) > 4;
    });
    expect(drifted).toEqual([]);
  });

  it("reproduces daisyUI, and where it does not, the formula does not either", () => {
    // Stated independently rather than imported, because it is the thing being compared against:
    // the rule as read off daisyUI's output, with no branch choice and no AA floor.
    const formula = (fill: string) => {
      const { l, c, h } = oklch(fill);
      return l >= 0.58 ? hex({ l: l * 0.2, c: c * 0.2, h }) : hex({ l: 0.8 + 0.2 * l, c: c * 0.2, h });
    };
    // 21 of the 23 land within ΔE 8 of the shipped ink. The other two are pairs a person adjusted
    // after generating — and what makes that a claim rather than an excuse is that the plain
    // formula misses them by exactly as much as we do, so the deviation is never ours.
    const off = DAISY.map(([name, fill, ink]) => ({
      name,
      theirs: ink,
      ours: inkFor(fill),
      d: deltaE(ink, inkFor(fill)),
      handAdjusted: inkFor(fill) === formula(fill),
    })).filter((r) => r.d > 8 && !r.handAdjusted);
    expect(off).toEqual([]);

    // …and the escape hatch must stay narrow, or it stops meaning anything.
    const agreeing = DAISY.filter(([, fill, ink]) => deltaE(ink, inkFor(fill)) <= 8);
    expect(agreeing.length).toBeGreaterThanOrEqual(20);
  });

  it("clears AA on daisyUI's fills too", () => {
    const short = DAISY.map(([name, fill]) => ({
      name,
      ratio: contrast(fill, inkFor(fill)),
    })).filter((r) => r.ratio < AA);
    expect(short).toEqual([]);
  });
});

describe("pageInk", () => {
  /**
   * The four `--*-foreground` values the sixteen shipped themes author, beside the fill and the
   * ground they were chosen against. This is the whole corpus, not a sample: the claim is that one
   * ratio reproduces every one of them, and a sample could not carry that.
   */
  it("reproduces every authored page ink in the corpus", () => {
    const themeDir = resolve(__dirname, "..", "themes");
    const off: string[] = [];
    let measured = 0;
    for (const file of readdirSync(themeDir).filter((f) => f.endsWith(".css"))) {
      const css = readFileSync(join(themeDir, file), "utf8");
      const value = (token: string) =>
        new RegExp(`^\\s*${token}:\\s*(#[0-9a-f]{6})`, "im").exec(css)?.[1]?.toLowerCase() ?? null;
      const ground = value("--foreground");
      if (!ground) continue;
      for (const family of ["destructive", "info", "success", "warning"]) {
        const [fill, authored] = [value(`--${family}`), value(`--${family}-foreground`)];
        if (!fill || !authored) continue;
        measured++;
        const d = deltaE(authored, pageInk(fill, ground));
        if (d > 5) off.push(`${file.slice(0, -4)}/${family}: ${authored} vs ${pageInk(fill, ground)} (ΔE ${d.toFixed(1)})`);
      }
    }
    expect(measured).toBeGreaterThan(40); // a corpus that emptied would pass vacuously
    expect(off).toEqual([]);
  });

  it("is not inkFor — it keeps the family, where inkFor leaves it", () => {
    // The failure this prevents is using one where the other belongs. A page ink stays recognisably
    // the fill's colour; an on-fill ink is pulled to whichever end reads, which for a mid-lightness
    // red means near-black. Same input, and they must not agree.
    const [fill, ground] = ["#e7000b", "#0f0f0f"];
    expect(pageInk(fill, ground)).not.toBe(inkFor(fill));
    expect(oklch(pageInk(fill, ground)).c).toBeGreaterThan(oklch(inkFor(fill)).c);
  });
});
