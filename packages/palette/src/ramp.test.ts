import { describe, expect, it } from "vitest";
import { familyOf } from "./derive-scheme.js";
import { BASE16_SLOTS, paletteData } from "./index.js";
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
import {
  CHROMA_PROFILE,
  RAMP_LENGTH,
  TINT_FLOOR,
  TINT_PROFILE,
  TINT_REFERENCE,
  checkRamp,
  deriveRamp,
  maxChroma,
  over,
  toHex,
} from "./ramp.js";

/**
 * A ramp is generated, so nothing here can be checked by reading it. These are the measurements
 * that stand in for that, and every one names the silent failure it catches — the failures are all
 * of the same kind, because a wrong ramp still renders. It just renders a hover nobody can see, or
 * a focus ring at 2.3:1, or a `--muted-foreground` that cannot be read on `--muted`.
 */

const MODES = ["light", "dark"] as const;
const RAMPS = paletteData.ramps as unknown as Record<string, Record<string, string>>;
const ACCENT_SLOTS = ["base08", "base09", "base0A", "base0B", "base0C", "base0D", "base0E", "base0F"];

/** Tailwind `neutral` — achromatic, and the hardest case, since chroma 0 must still be legal. */
const NEUTRAL = "#737373";
/** The 17 chromatic families this system ships, at the step its ramps are seeded from. */
const FAMILIES: [string, string][] = Object.entries(RAMPS).map(([n, s]) => [n, s["500"] as string]);
const SEEDS: [string, string][] = [["base", NEUTRAL], ...FAMILIES];

/**
 * Tinted neutrals: a hue given deliberately, at a chroma far under `CHROMA_FLOOR`.
 *
 * The second half of a tenant's palette. Radix's own five (step 9 of mauve, slate, sage, olive,
 * sand) plus Tailwind's tinted greys, which is the range a client's base seed will land in.
 */
const TINTS: [string, string][] = [
  ["mauve", "#8e8c99"],
  ["slate", "#8b8d98"],
  ["sage", "#868e8b"],
  ["olive", "#898e87"],
  ["sand", "#8d8d86"],
  ["tw-gray", "#6b7280"],
  ["tw-zinc", "#71717b"],
  ["tw-stone", "#79716b"],
];

const accentsOf = (palette: string) =>
  ACCENT_SLOTS.map(
    (slot) => (BASE16_SLOTS[palette] as { slots: Record<string, string> }).slots[slot] as string,
  );
const BASE16 = Object.keys(BASE16_SLOTS).flatMap((name) =>
  accentsOf(name).map((hex, i) => [`${name}.${ACCENT_SLOTS[i]}`, hex] as [string, string]),
);

const ALL: [string, string][] = [...SEEDS, ...BASE16];

/** Only `carries-identity` is a legitimate standing relief; it is what a grey seed always takes. */
const unexpected = (mode: Mode, seed: string) =>
  deriveRamp(seed, mode).relief.filter((r) => r.id !== "carries-identity");

describe("deriveRamp", () => {
  for (const mode of MODES) {
    it(`produces twelve real values from every seed we have, in ${mode}`, () => {
      for (const [name, seed] of ALL) {
        const { steps } = deriveRamp(seed, mode);
        expect(steps, name).toHaveLength(RAMP_LENGTH);
        for (const hex of steps) expect(hex, `${name} → ${hex}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    });

    it(`meets every obligation for every seed we have, in ${mode}`, () => {
      // The sweep. 18 system seeds and 48 base16 accents, and the only relief any of them takes is
      // `carries-identity` — which is not a defect but the honest answer for a colour below the
      // chroma floor. A regression anywhere in the geometry shows up here first.
      const failing = ALL.map(([name, seed]) => [name, unexpected(mode, seed)] as const).filter(
        ([, relief]) => relief.length,
      );
      expect(failing.map(([name, relief]) => `${name}: ${JSON.stringify(relief)}`)).toEqual([]);
    });

    it(`starts on the surface the rest of this package measures against, in ${mode}`, () => {
      // Step 1 is not "a background", it is *the* background. If it drifted from SURFACE[mode] the
      // ramp would be grading itself against a page nobody renders, and every ratio below — every
      // one of which is measured against step 1 — would be a number about nothing.
      for (const [name, seed] of SEEDS) {
        const { steps } = deriveRamp(seed, mode);
        expect(contrast(steps[0] as string, SURFACE[mode]), name).toBeLessThan(1.05);
      }
    });

    it(`walks away from the surface and never back, in ${mode}`, () => {
      // A ramp out of order still renders. It just renders a "hover" lighter than its rest state and
      // a border paler than the surface it sits on — which is why `palettes.test.ts` already asserts
      // this of base00→base05, and why it has to be asserted here too.
      for (const [name, seed] of SEEDS) {
        const { steps } = deriveRamp(seed, mode);
        // Step 10 is the solid's hover and sits between 9 and 11 — it is not a rung of the path.
        const path = [...steps.slice(0, 9), steps[10] as string, steps[11] as string];
        const ls = path.map((hex) => oklch(hex).l);
        const sorted = [...ls].sort((a, b) => (mode === "light" ? b - a : a - b));
        expect(ls, `${name} is not monotone`).toEqual(sorted);
      }
    });

    it(`keeps every hover visible, in ${mode}`, () => {
      // Steps 3/4/5 are one component's normal, hover and active. An increment below ΔE 2 is a
      // hover that does nothing on hover — the defect is entirely invisible in code review, because
      // the two values differ.
      for (const [name, seed] of SEEDS) {
        const { steps } = deriveRamp(seed, mode);
        for (const step of [4, 5, 10]) {
          const previous = step === 10 ? 9 : step - 1;
          expect(
            deltaE(steps[step - 1] as string, steps[previous - 1] as string),
            `${name} step ${previous}→${step}`,
          ).toBeGreaterThanOrEqual(2);
        }
      }
    });

    it(`keeps a component surface from becoming a border, in ${mode}`, () => {
      // The 3–5 / 6–8 split only means something if the loudest surface stays under the quietest
      // border's bar. Without it the ramp spends six steps on one visual level.
      for (const [name, seed] of SEEDS) {
        const { steps } = deriveRamp(seed, mode);
        expect(contrast(steps[4] as string, steps[0] as string), name).toBeLessThan(CONTRAST_MIN);
      }
    });

    it(`lands a solid that reads as a shape, in ${mode}`, () => {
      // The defect this package already paid for, as a test. `--success` and `--warning` shipped at
      // emerald-500 and amber-500, measuring 2.37 and 2.05 against the page, so a filled badge was
      // barely visible — WCAG asks 3:1 of a non-text element. Both seeds are in this sweep, and
      // both now land at 3.02 and 3.01 because step 9 is pulled until it does.
      for (const [name, seed] of SEEDS) {
        const { steps } = deriveRamp(seed, mode);
        expect(contrast(steps[8] as string, steps[0] as string), name).toBeGreaterThanOrEqual(
          CONTRAST_MIN,
        );
      }
    });

    it(`lands a solid the rest of the system would accept, in ${mode}`, () => {
      // Step 9 is where a chart slot, a status fill and the brand all come from, and those already
      // answer to BAND[mode]. A step 9 outside it is a value `checkScheme` would refuse — the ramp
      // and the scheme checker would be describing two different systems.
      const [lo, hi] = BAND[mode];
      for (const [name, seed] of SEEDS) {
        const { l } = oklch(deriveRamp(seed, mode).steps[8] as string);
        expect(l, `${name} solid out of band`).toBeGreaterThanOrEqual(lo);
        expect(l, `${name} solid out of band`).toBeLessThanOrEqual(hi);
      }
    });

    it(`carries readable text on the page and on the loudest surface, in ${mode}`, () => {
      // Two obligations, and the second is the one Radix does not make: this system's documented
      // naming contract (tokens.css) is that `-foreground` is the ink meant to sit ON the fill of
      // the same name, so `--muted-foreground` on `--muted` is the rule and not a hypothetical.
      // Radix's own step 11 measures 3.19–4.58 on its step 5 and would fail this.
      for (const [name, seed] of SEEDS) {
        const { steps } = deriveRamp(seed, mode);
        const [page, surface] = [steps[0] as string, steps[4] as string];
        expect(contrast(steps[10] as string, page), `${name} 11 on page`).toBeGreaterThanOrEqual(TEXT_MIN);
        expect(contrast(steps[10] as string, surface), `${name} 11 on step 5`).toBeGreaterThanOrEqual(TEXT_MIN);
        expect(contrast(steps[11] as string, page), `${name} 12 on page`).toBeGreaterThanOrEqual(7);
        expect(contrast(steps[11] as string, surface), `${name} 12 on step 5`).toBeGreaterThanOrEqual(TEXT_MIN);
      }
    });

    it(`carries AA ink on its own solid, in ${mode}`, () => {
      // The `text-white` defect, generalised. On-fill text was a literal in two components and it
      // failed AA on every status fill, worst at 2.13:1, because no token meant nothing to measure.
      // Here the ink is part of the ramp, so there is something to measure.
      for (const [name, seed] of ALL) {
        const { steps, onSolid } = deriveRamp(seed, mode);
        expect(contrast(onSolid, steps[8] as string), name).toBeGreaterThanOrEqual(TEXT_MIN);
      }
    });

    it(`keeps the seed's hue through every step, in ${mode}`, () => {
      // No hue is written by hand — and a hue written by *gamut clipping* is no better. Requesting
      // more chroma than sRGB holds has to come back as less chroma, never as a rotation, or the
      // ramp quietly retints itself at exactly the steps where the seed is most extreme.
      //
      // Graded as the offset the drift produces in a/b, not as an angle, and over tinted seeds as
      // well as saturated ones. Skipping steps under `CHROMA_FLOOR` — which is what this test used
      // to do — passes every tinted ramp without grading a single one of its steps.
      for (const [name, seed] of [...FAMILIES, ...TINTS]) {
        const { steps, hue } = deriveRamp(seed, mode);
        expect(hue, name).not.toBeNull();
        for (const hex of steps) {
          const o = oklch(hex);
          const off = 100 * o.c * Math.sin((hueDistance(o.h, hue as number) * Math.PI) / 180);
          expect(off, `${name} → ${hex} (c ${o.c.toFixed(4)})`).toBeLessThan(0.52);
        }
      }
    });
  }

  it("reports which step can bound a control, instead of assuming step 8 can", () => {
    // The finding that has to reach the role table. WCAG 1.4.11 asks 3:1 of a focus ring, and which
    // step delivers it cannot be predicted — it is dominated by the mode and still moves with the
    // seed. So the guarantee asserted here is the one that is actually true: a boundary exists at
    // or before the solid, and the step reported really does clear 3:1.
    //
    // An earlier version of this test asserted 9-light/8-dark over `FAMILIES` and passed, because
    // the Tailwind -500 seeds happen to be uniform. They are not representative: `#e7000b` and
    // `#155dfc` both give 9 in dark. That is the failure this now catches — a test that held only
    // over the seeds it was written against, and would have sent a literal to the role table.
    for (const mode of MODES) {
      for (const [name, seed] of ALL) {
        const { steps, boundary } = deriveRamp(seed, mode);
        expect(boundary, name).toBeLessThanOrEqual(9);
        expect(contrast(steps[boundary - 1] as string, steps[0] as string), name).toBeGreaterThanOrEqual(
          CONTRAST_MIN,
        );
      }
    }
    expect(deriveRamp("#2b7fff", "dark").boundary).toBe(8);
    expect(deriveRamp("#e7000b", "dark").boundary).toBe(9);
    expect(deriveRamp("#155dfc", "dark").boundary).toBe(9);
  });

  it("is not an inversion of the other mode", () => {
    // The one shortcut this package has already measured the cost of: BAND differs per mode, so a
    // flipped light value lands outside the dark band. Three more things differ here — the growth
    // rate, the chroma profile and where the ink is anchored — so a ramp and its counterpart are
    // never each other's mirror. This is the test that fails if someone "simplifies" it to a flip.
    for (const [name, seed] of FAMILIES) {
      const light = deriveRamp(seed, "light");
      const dark = deriveRamp(seed, "dark");
      const mirrored = [...dark.steps].reverse();
      const worst = Math.max(...light.steps.map((hex, i) => deltaE(hex, mirrored[i] as string)));
      expect(worst, `${name} reads as an inversion`).toBeGreaterThan(10);
    }
  });
});

describe("a tinted neutral", () => {
  for (const mode of MODES) {
    it(`keeps a hue that was given on purpose, in ${mode}`, () => {
      // The requirement the chroma floor was silently defeating. A tenant hands over two seeds, and
      // the neutral one is tinted Radix-style — a hue at c 0.010–0.023, well under `CHROMA_FLOOR`
      // because that is *what a neutral is*. Flattening it ships a product that reads as grey.
      for (const [name, seed] of TINTS) {
        const ramp = deriveRamp(seed, mode);
        expect(ramp.hue, `${name} lost its hue`).not.toBeNull();
        expect(oklch(seed).c, name).toBeLessThan(CHROMA_FLOOR);
        // Every step is tinted, including the near-white ones, which is the entire point: a product
        // reads as a colour through the surfaces that are barely coloured at all. A ramp that kept
        // the hue only where chroma was already high would pass a naive check and look grey.
        for (const hex of ramp.steps) expect(oklch(hex).c, `${name} → ${hex}`).toBeGreaterThan(0);
        // And visibly so across the surfaces, not merely non-zero. Steps 1–8 are where most of a
        // product's pixels are; a model that let the tint decay to nothing there would satisfy the
        // chroma assertion above and still ship a grey-looking application.
        const surfaces = ramp.steps
          .slice(0, 8)
          .map((hex) => deltaE(hex, toHex(oklch(hex).l, 0, 0)));
        expect(
          Math.max(...surfaces),
          `${name} surfaces are indistinguishable from grey`,
        ).toBeGreaterThan(0.5);
      }
    });

    it(`gives back the seed it was handed, in ${mode}`, () => {
      // A base seed is a legal step 9 by construction — it is mid-lightness and low chroma — so
      // nothing should move it. If a tinted ramp needed an adjustment, the tint model would be
      // fighting the band or the contrast rule rather than sitting inside them.
      for (const [name, seed] of TINTS) {
        const ramp = deriveRamp(seed, mode);
        expect(ramp.steps[8], name).toBe(seed);
        expect(ramp.adjustments, name).toEqual([]);
      }
    });

    it(`still says it carries no identity, in ${mode}`, () => {
      // Generation and reporting are different questions, and this is the seam between them. The
      // hue is kept because it was given; the relief still fires because a tint is not a brand.
      // Collapsing the two is what produced the bug — one constant answering both.
      for (const [name, seed] of TINTS) {
        expect(deriveRamp(seed, mode).relief.map((r) => r.id), name).toEqual(["carries-identity"]);
      }
    });

    it(`meets every other obligation, in ${mode}`, () => {
      // The tint must not buy itself relief anywhere else. `checkRamp` re-measures from the hexes.
      for (const [name, seed] of TINTS) {
        const ramp = deriveRamp(seed, mode);
        expect(
          checkRamp(ramp.steps, mode, ramp.onSolid, ramp.alpha)
            .map((r) => r.id)
            .filter((id) => id !== "carries-identity"),
          name,
        ).toEqual([]);
      }
    });
  }

  it("drops a hue that is encoding noise rather than a colour", () => {
    // The other side of the threshold, and the reason it is a measured number. Below `TINT_FLOOR`
    // the angle in a/b is float error, and propagating it across twelve steps would be writing a
    // hue nobody chose. Measured, flattening there costs less than `DISTINCT` — the bound this
    // package uses for whether two colours differ at all — so nothing visible is lost.
    for (const mode of MODES) {
      for (const c of [0, 0.0005, 0.001, 0.002, 0.003]) {
        const seed = toHex(0.55, c, 220);
        const ramp = deriveRamp(seed, mode);
        expect(oklch(seed).c, `c=${c}`).toBeLessThan(TINT_FLOOR);
        expect(ramp.hue, `c=${c} ${mode} kept a noise hue`).toBeNull();
        // 1e-6, not 0: a grey hex round-trips through OKLab with float residue in a/b, which is
        // exactly the noise this threshold exists to refuse propagating.
        for (const hex of ramp.steps) expect(oklch(hex).c).toBeLessThan(1e-6);
      }
      // And just above it the hue survives — the threshold is a real boundary, not a way of
      // rounding every low-chroma seed to grey.
      const kept = deriveRamp(toHex(0.55, 0.006, 220), mode);
      expect(kept.hue, mode).not.toBeNull();
    }
  });

  it("leaves a brand colour exactly where it was", () => {
    // The tint floor lifts the low steps of a neutral. It must do nothing at all to a saturated
    // seed, or every chromatic ramp in the suite would have shifted underneath the obligations that
    // were calibrated against it. `min(c9, TINT_REFERENCE)` is what guarantees that, and this is
    // the assertion that would catch its removal.
    for (const mode of MODES) {
      for (const [name, seed] of FAMILIES) {
        const c9 = oklch(deriveRamp(seed, mode).steps[8] as string).c;
        for (let i = 0; i < RAMP_LENGTH; i++) {
          expect(
            (TINT_PROFILE[mode][i] as number) * Math.min(c9, TINT_REFERENCE[mode]),
            `${name} step ${i + 1} was lifted by the tint floor`,
          ).toBeLessThanOrEqual((CHROMA_PROFILE[mode][i] as number) * c9);
        }
      }
    }
  });
});

describe("a seed that cannot meet an obligation", () => {
  it("says a base ramp carries no identity, rather than manufacturing a tint", () => {
    // The achromatic case, which is the hardest one: chroma 0 must still produce a legal ramp. It
    // does — every other obligation is met — and the one it cannot meet is published instead of
    // being papered over with an invented hue. A generator that tinted a grey to pass its own
    // chroma check would be inventing brand, which is the mistake `Palette.primary` exists to avoid.
    for (const mode of MODES) {
      const ramp = deriveRamp(NEUTRAL, mode);
      expect(ramp.hue).toBeNull();
      expect(ramp.relief.map((r) => r.id)).toEqual(["carries-identity"]);
      for (const hex of ramp.steps) expect(oklch(hex).c).toBeLessThan(CHROMA_FLOOR);
    }
  });

  it("calls exactly the accents the scheme layer refuses flat", () => {
    // Two layers, one rule. `familyOf` returns null below the chroma floor and a ramp reports
    // `carries-identity` — if the two ever disagreed, a palette could contribute a category to a
    // chart that its own ramp says has no colour in it, or the reverse.
    for (const mode of MODES) {
      const flat = BASE16.filter(([, hex]) =>
        deriveRamp(hex, mode).relief.some((r) => r.id === "carries-identity"),
      ).map(([name]) => name);
      const refused = BASE16.filter(([, hex]) => familyOf(hex) === null).map(([name]) => name);
      expect(flat).toEqual(refused);
    }
  });

  it("survives the extremes without producing an illegal ramp", () => {
    // White, black and the page colours themselves are where a lightness-anchored generator divides
    // by a zero span or walks out of the band. They are also real inputs: a customer's brand sheet
    // can name #000000, and the answer must be a legal ramp plus an honest note, not a throw.
    for (const seed of ["#ffffff", "#000000", SURFACE.light, SURFACE.dark, "#ffff00", "#0000ff"]) {
      for (const mode of MODES) {
        const ramp = deriveRamp(seed, mode);
        expect(ramp.steps, `${seed} ${mode}`).toHaveLength(RAMP_LENGTH);
        expect(
          ramp.relief.filter((r) => r.id !== "carries-identity"),
          `${seed} ${mode}`,
        ).toEqual([]);
      }
    }
  });

  it("measures what a foreign seed gives up, instead of pretending it gave up nothing", () => {
    // The counterpart of `deriveScheme`'s "keeps the palette's hues and not its mood", and the trade
    // runs the other way. A scheme snaps a borrowed colour onto the nearest of 17 family ramps, so
    // it keeps the mood's *place* and loses the hue — measured over the 35 chromatic base16 accents,
    // 4.5° of hue on average and 20.5° at worst (Dracula's #f1fa8c becomes a lime). A ramp keeps the
    // hue to within 0.72° and spends lightness instead: Dracula's green #50fa7b becomes #00a843,
    // ΔE 23.6, all of it lightness and chroma.
    const dracula = deriveRamp("#50fa7b", "light");
    expect(dracula.drift.hue).toBeLessThan(1);
    expect(dracula.drift.lightness).toBeLessThan(-0.2);
    expect(dracula.drift.deltaE).toBeGreaterThan(20);
    // And a seed that is already legal gives up nothing at all — the drift is a measurement, not a
    // constant cost applied to everything that passes through.
    expect(deriveRamp("#2b7fff", "light").drift.deltaE).toBe(0);
  });
});

describe("the alpha scale", () => {
  for (const mode of MODES) {
    it(`reproduces every solid step over the ramp's own page, in ${mode}`, () => {
      // The only obligation an alpha step can carry, and the reason the scale exists. The background
      // it will really sit on is unknown by construction — that is the whole point of it — so no
      // contrast rule about it is well-formed. What can be promised is that nothing changes on a
      // normal page: `a3` and `3` are the same component until something is put behind one of them.
      for (const [name, seed] of ALL) {
        const { steps, alpha } = deriveRamp(seed, mode);
        expect(alpha, name).toHaveLength(RAMP_LENGTH);
        for (let i = 0; i < RAMP_LENGTH; i++) {
          expect(alpha[i], `${name} a${i + 1}`).toMatch(/^#[0-9a-f]{8}$/);
          expect(
            deltaE(over(alpha[i] as string, steps[0] as string), steps[i] as string),
            `${name} a${i + 1} does not composite to step ${i + 1}`,
          ).toBeLessThanOrEqual(1.5);
        }
      }
    });

    it(`is more transparent the closer the step is to the page, in ${mode}`, () => {
      // Minimum alpha is the objective — any larger value also composites correctly and shows less
      // through, which defeats the purpose. A solver that returned a constant, or that gave up and
      // returned full opacity, would still pass the fidelity test above while leaving nothing to
      // see through: that is the failure this catches, and it is the one the first version had.
      //
      // Asserted over a1→a9, the arc where show-through is the point. Past the solid the steps are
      // essentially opaque and the last few can wobble by a level, because a target channel pinned
      // at the gamut edge costs alpha to reach — the same effect `ALPHA_SOLVE` is sized around.
      for (const [name, seed] of SEEDS) {
        const opacity = deriveRamp(seed, mode).alpha.map((hex) =>
          Number.parseInt(hex.slice(7, 9), 16),
        );
        expect(opacity[0], `${name} a1 is not fully transparent`).toBe(0);
        const arc = opacity.slice(0, 9);
        expect(arc, `${name} a1–a9 opacity is not rising`).toEqual([...arc].sort((a, b) => a - b));
        expect(new Set(arc).size, `${name} repeats an alpha across the arc`).toBe(9);
        expect(opacity[11], `${name} a12 is not effectively opaque`).toBeGreaterThan(230);
      }
    });
  }

  it("is not what `bg-x/60` does", () => {
    // The distinction the graph canvas turns on, and the reason this is a scale rather than an
    // opacity utility. `bg-x/60` dilutes the *solid*: on the page it lands somewhere between step 9
    // and step 1 that corresponds to no step of the ramp, and on the canvas it lands somewhere else
    // again. The alpha scale has one value per step, each solved for that step. If a fixed weight
    // ever agreed with a step, the scale would be redundant.
    const { steps } = deriveRamp("#2b7fff", "light");
    const diluted = `${steps[8]}99`; // the solid at 60%
    const onPage = over(diluted, steps[0] as string);
    const nearest = Math.min(...steps.map((hex) => deltaE(onPage, hex)));
    expect(nearest, "a fixed 60% dilution happens to be a step").toBeGreaterThan(2);
    // And it is a *different* colour on the canvas, which is the dependency the scale removes.
    expect(deltaE(onPage, over(diluted, "#1e1e1e"))).toBeGreaterThan(10);
  });
});

describe("what the seed gave up", () => {
  it("itemises every move, with the rule that forced it", () => {
    // The gate policy, as a record: adjust to the nearest legal value and publish what moved. This
    // is what an onboarding screen shows a client whose brand colour could not be used as given, so
    // each entry has to name the rule, both values, and the decomposition — "darker, and slightly
    // less saturated" is a very different thing to hear than "a different colour".
    const amber = deriveRamp("#fe9a00", "light");
    expect(amber.adjustments.length).toBeGreaterThan(0);
    for (const move of amber.adjustments) {
      expect(move.from).toMatch(/^#[0-9a-f]{6}$/);
      expect(move.to).toMatch(/^#[0-9a-f]{6}$/);
      expect(move.from).not.toBe(move.to);
      expect(move.reason.length).toBeGreaterThan(40);
      expect(move.deltaE).toBeGreaterThan(0);
      // Whatever moved, the hue did not. That is the promise the whole layer is built on.
      expect(move.hue).toBeLessThan(1);
    }
    // The chain is a story: each move starts where the last one left off, and the last one lands on
    // the step actually shipped. A record whose links did not join would be three separate claims
    // about the same colour, and a reader could not tell which one was the outcome.
    const last = amber.adjustments[amber.adjustments.length - 1];
    expect(last?.to).toBe(amber.steps[8]);
    for (let i = 1; i < amber.adjustments.length; i++) {
      expect(amber.adjustments[i]?.from).toBe(amber.adjustments[i - 1]?.to);
    }
  });

  it("says nothing when nothing moved", () => {
    // A record that always had something in it would be noise, and an onboarding screen that always
    // apologises teaches the client to stop reading it. Blue-500 is already legal in both modes.
    for (const mode of MODES) {
      const ramp = deriveRamp("#2b7fff", mode);
      expect(ramp.adjustments, mode).toEqual([]);
      expect(ramp.steps[8], mode).toBe("#2b7fff");
    }
  });

  it("cannot adjust a grey into an identity, and does not pretend to", () => {
    // The one place *adjust and publish* does not apply, and the reason it is a `relief` rather than
    // an `adjustment`: the nearest legal value for a colour below the chroma floor would be a hue,
    // and there is no hue in the seed to move toward. Choosing one is manufacturing brand out of
    // grey — the thing `Palette.primary` exists to refuse.
    for (const mode of MODES) {
      const ramp = deriveRamp(NEUTRAL, mode);
      expect(ramp.adjustments, mode).toEqual([]);
      expect(ramp.relief.map((r) => r.id), mode).toEqual(["carries-identity"]);
    }
  });
});

describe("checkRamp", () => {
  it("agrees with what deriveRamp published", () => {
    // The generator's relief is the checker's verdict, or one of them is lying about the values a
    // browser will actually paint. Re-run over the hexes alone, with no access to the floats they
    // came from.
    for (const mode of MODES) {
      for (const [name, seed] of ALL) {
        const ramp = deriveRamp(seed, mode);
        expect(checkRamp(ramp.steps, mode, ramp.onSolid, ramp.alpha), name).toEqual(ramp.relief);
      }
    }
  });

  it("bites when a ramp is wrong", () => {
    // A gate is only worth having if it fails something. Each of these is a plausible mistake —
    // a step edited by hand, a ramp built for the other mode, a length that drifted — and each has
    // to come back with the specific obligation rather than a bare false.
    const good = deriveRamp("#2b7fff", "light");
    expect(checkRamp(good.steps, "light", good.onSolid, good.alpha)).toEqual([]);
    // An alpha scale built for the other mode's page composites to the wrong colours on this one.
    expect(
      checkRamp(good.steps, "light", good.onSolid, deriveRamp("#2b7fff", "dark").alpha)
        .map((r) => r.id),
    ).toContain("alpha-fidelity");

    // Its own values, graded against the other mode's surface: the background is no longer the page.
    expect(checkRamp(good.steps, "dark").map((r) => r.id)).toContain("surface");
    // Steps 4 and 5 collapsed onto 3 — the invisible hover.
    const flattened = [...good.steps];
    flattened[3] = flattened[2] as string;
    flattened[4] = flattened[2] as string;
    expect(checkRamp(flattened, "light").map((r) => r.id)).toContain("hover");
    // The text steps swapped, which keeps every value in the ramp and breaks the order.
    const swapped = [...good.steps];
    [swapped[10], swapped[11]] = [swapped[11] as string, swapped[10] as string];
    expect(checkRamp(swapped, "light").map((r) => r.id)).toContain("monotone");
    // A truncated ramp is not a short ramp, it is not a ramp.
    expect(checkRamp(good.steps.slice(0, 11), "light")).toHaveLength(1);
  });
});

describe("the shape the values come from", () => {
  it("peaks the chroma at step 9, which is what makes it the solid", () => {
    // Radix's own documented claim about its scale, and the property the whole profile exists to
    // express: step 9 is "the purest step". A profile that peaked elsewhere would make some border
    // more saturated than the brand.
    for (const mode of MODES) {
      const profile = CHROMA_PROFILE[mode];
      expect(profile).toHaveLength(RAMP_LENGTH);
      expect(Math.max(...profile)).toBe(profile[8]);
      for (let i = 1; i <= 8; i++) {
        expect((profile[i] as number) > (profile[i - 1] as number), `${mode} step ${i + 1}`).toBe(true);
      }
    }
  });

  it("round-trips OKLCH through sRGB", () => {
    // `toHex` is the one piece of arithmetic here that `palette-check.ts` does not already own, so
    // it is the one place a transposed matrix would hide. It would not throw and it would not look
    // wrong — every ramp would simply be a slightly different colour than the one requested, and
    // every obligation would still pass, because they are all measured on the output.
    for (const l of [0.15, 0.4, 0.65, 0.9]) {
      for (const h of [0, 60, 140, 220, 300]) {
        const c = maxChroma(l, h) * 0.8;
        const back = oklch(toHex(l, c, h));
        expect(back.l, `L ${l} h ${h}`).toBeCloseTo(l, 2);
        expect(back.c, `c at L ${l} h ${h}`).toBeCloseTo(c, 2);
        // The hue tolerance is 8-bit quantisation, not slack. Angular error goes as one channel
        // level divided by the chroma, so it is worst where the gamut is narrowest — both ends of
        // the lightness range. Measured across this grid the worst is 3.9° at L 0.15; in the middle
        // it is under a degree. A transposed matrix misses by tens of degrees at every L.
        expect(hueDistance(back.h, h), `h ${h} at L ${l}`).toBeLessThan(5);
      }
    }
  });

  it("reduces chroma rather than clipping a channel", () => {
    // Asking for more chroma than sRGB holds must come back in gamut at the same hue. Clipping the
    // channels instead is the easy wrong answer: it also produces a valid hex, and it rotates the
    // hue by up to tens of degrees at exactly the saturated steps.
    for (const h of [0, 30, 110, 200, 270, 330]) {
      const hex = toHex(0.6, 0.4, h);
      expect(oklch(hex).c).toBeLessThanOrEqual(maxChroma(0.6, h) + 0.01);
      expect(hueDistance(oklch(hex).h, h), `hue at ${h}`).toBeLessThan(2);
    }
  });
});
