import { describe, expect, it } from "vitest";
import paletteDataJson from "../palette-data.json";
import { CONTRAST_MIN, TEXT_MIN, contrast, deltaE, oklch, type Mode } from "./palette-check.js";
import { STATUS_NAMES, type CategoricalSet, type RampName, type RampSet } from "./palette-document.js";
import {
  CHART_SLOTS,
  ELEVATION,
  ELEVATION_CEILING,
  IDENTITY_RELIEF,
  OTHER,
  ROLES,
  SOLID_STEP,
  elevate,
  fillStep,
  resolveRoles,
} from "./roles.js";
import { RAMP_LENGTH, deriveRamp, over, toHex } from "./ramp.js";

/**
 * The role table is data, so most of it can be read. What cannot be read is the part that made it
 * one column instead of two: `boundary`, `fill` and `on-fill` are measured off a ramp rather than written
 * down, and `elevation` is a parameter rather than a second set of steps. Those three are where a
 * silent wrong value can still be a legal stylesheet, so those three are what these measure.
 */

const MODES = ["light", "dark"] as const;

const rampsFor = (brand: string, neutral: string): RampSet => {
  const seeds: Record<RampName, string> = {
    brand,
    neutral,
    destructive: "#e7000b",
    warning: "#e17100",
    success: "#009966",
    info: "#155dfc",
  };
  return Object.fromEntries(
    (Object.keys(seeds) as RampName[]).map((name) => [
      name,
      { light: deriveRamp(seeds[name], "light"), dark: deriveRamp(seeds[name], "dark") },
    ]),
  ) as RampSet;
};

/** A tinted neutral, the way a client's actually arrives — a hue at a chroma five times under the floor. */
const RAMPS = rampsFor("#7f22fe", "#6e737b");

const CATEGORICAL = (capacity: number): CategoricalSet => {
  const slots = ["#2b7fff", "#008236", "#7f22fe", "#a65f00", "#0092b8", "#f54a00", "#e12afb", "#ff2056"];
  return {
    source: { from: "brand-wheel", hue: 292.9, family: "violet", spokes: 9 },
    light: slots.slice(0, capacity),
    dark: slots.slice(0, capacity),
    capacity,
    families: [],
    kept: [],
    crowded: [],
    dropped: [],
    separation: { light: 0, dark: 0 },
    leading: { light: 0, dark: 0 },
  };
};

const valuesOf = (mode: Mode, capacity = CHART_SLOTS): Record<string, string> =>
  Object.fromEntries(resolveRoles(RAMPS, CATEGORICAL(capacity), mode).map((r) => [r.token, r.value]));

/** Kanzo's own seeds — the achromatic brand that forced the fill rule. */
const GREY_RAMPS = rampsFor("#737373", "#737373");
const GREY = GREY_RAMPS.brand;

const greyValues = (mode: Mode): Record<string, string> =>
  Object.fromEntries(
    resolveRoles(GREY_RAMPS, CATEGORICAL(CHART_SLOTS), mode).map((r) => [r.token, r.value]),
  );

describe("the table itself", () => {
  it("binds each token exactly once", () => {
    // Two rows for one token is a coin toss decided by emit order, and the loser is invisible: the
    // stylesheet is still valid CSS and the last declaration silently wins.
    const tokens = ROLES.map((role) => role.token);
    expect(new Set(tokens).size).toBe(tokens.length);
    for (const token of tokens) expect(token, token).toMatch(/^--[a-z0-9-]+$/);
  });

  it("is one column — only a fixed value may differ between the modes", () => {
    // The claim the whole design rests on. Every other kind names a ramp and a property, and the
    // ramp answers per mode; if a `step` binding could carry a per-mode number, the table would be
    // the 113-expression enumeration it replaced, wearing a different shape.
    for (const { token, binding } of ROLES) {
      if (binding.kind === "fixed") {
        expect(Object.keys(binding.value).sort(), token).toEqual(["dark", "light"]);
      } else {
        expect(JSON.stringify(binding), token).not.toMatch(/"(light|dark)"/);
      }
    }
  });

  it("covers every colour token the system already publishes", () => {
    // The drift guard. A token in the vocabulary with no binding is a token the compiled sheet does
    // not set — which does not throw, it just falls through to whatever `:root` had before, so the
    // symptom is a component that is subtly the wrong colour on one tenant.
    const tokens = new Set(ROLES.map((role) => role.token));
    for (const role of Object.keys(paletteDataJson.syntaxRoles)) {
      expect(tokens, role).toContain(`--kanzo-syntax-${role}`);
    }
    for (let i = 1; i <= CHART_SLOTS; i++) expect(tokens).toContain(`--chart-${i}`);
    for (const name of STATUS_NAMES) {
      // The three-token shape that dissolves the `-foreground`-means-two-things wart.
      for (const suffix of ["", "-foreground", "-content"]) expect(tokens).toContain(`--${name}${suffix}`);
    }
    for (const token of [
      "--sidebar",
      "--sidebar-foreground",
      "--sidebar-primary",
      "--sidebar-primary-foreground",
      "--sidebar-accent",
      "--sidebar-accent-foreground",
      "--sidebar-border",
      "--sidebar-ring",
    ]) {
      expect(tokens).toContain(token);
    }
  });
});

describe("elevation", () => {
  it("is a surface parameter and not twelve more steps", () => {
    // What "a sidebar and a popover are the same thing" means in arithmetic. The sixteen
    // `--sidebar-*` tokens mirrored the whole system for one component; here the sidebar reads the
    // same neutral ramp at an offset, and the offset is shared with the popover.
    expect(ELEVATION.sidebar).toEqual(ELEVATION.popover);
    expect(ELEVATION.page).toEqual({ light: 0, dark: 0 });
    // Light expresses elevation with shadow, dark with value — so every light offset is 0, and that
    // is a finding rather than an omission: a light card that lightened would have to pass the page.
    for (const surface of Object.values(ELEVATION)) expect(surface.light).toBe(0);
  });

  it("clamps before a raised surface becomes a border", () => {
    // Steps 3–5 are one component's normal/hover/active and 6–8 are borders. Without the ceiling,
    // `--sidebar-accent` at step 5 + δ2 would be step 7 — a hover surface as loud as the line drawn
    // around it, which is exactly what `still-a-surface` forbids.
    expect(elevate(5, "sidebar", "dark")).toBe(ELEVATION_CEILING);
    expect(elevate(1, "popover", "dark")).toBe(3);
    expect(elevate(1, "card", "dark")).toBe(2);
    expect(elevate(1, "popover", "light")).toBe(1);
    expect(elevate(12, undefined, "dark")).toBe(12);
  });

  it("raises the dark surfaces off the page and leaves the light ones on it", () => {
    const light = valuesOf("light");
    const dark = valuesOf("dark");
    for (const token of ["--card", "--popover", "--sidebar"]) {
      expect(light[token], token).toBe(light["--background"]);
      expect(dark[token], token).not.toBe(dark["--background"]);
    }
    expect(dark["--popover"]).toBe(dark["--sidebar"]);
  });

  it("stays an absolute step, because an alpha veil stops occluding and separates nothing", () => {
    // The measurement that keeps `elevation` an integer, kept as a test so the proposal is not made
    // twice. Binding a raised surface to `a[1+δ]` and letting the browser composite it over what is
    // beneath is the obvious cure for "elevation cannot stack" — and a panel is an occluder, not a
    // veil. Every shipped `alpha` binding (`--field`, editor selection and search) is a fill *inside*
    // a surface, which is the only place a transparency is honest.
    for (const [name, ramp] of [
      ["kanzo", GREY_RAMPS.neutral],
      ["nord", { light: deriveRamp("#4c566a", "light"), dark: deriveRamp("#4c566a", "dark") }],
      ["tinted", RAMPS.neutral],
    ] as const) {
      for (const mode of MODES) {
        const r = ramp[mode];
        const page = r.steps[0] as string;
        const k = Math.min(1 + (ELEVATION.popover[mode] as number), ELEVATION_CEILING);
        const veil = r.alpha[k - 1] as string;

        // 1. It stops occluding. The surface band's steps sit close together, so the alpha that
        //    reproduces them is near zero — byte 0 in light, 7–8/255 in dark. The page's own ink read
        //    through the popover comes back as itself.
        const byte = Number.parseInt(veil.slice(7, 9), 16);
        expect(byte, `${name} ${mode} popover veil opacity`).toBeLessThan(10);
        const ink = r.steps[RAMP_LENGTH - 1] as string;
        expect(
          contrast(over(veil, ink), ink),
          `${name} ${mode}: page ink is still legible through the popover`,
        ).toBeLessThan(1.1);

        // 2. It separates nothing. `alpha-fidelity` obliges `a[k]` over step 1 to BE step k, so over
        //    the page the values are the ones it replaces — and `--popover` against `--muted` in dark
        //    stays far inside the ramp's own `interchangeable` bound of 4.
        expect(
          deltaE(over(veil, page), r.steps[k - 1] as string),
          `${name} ${mode}: alpha elevation is not its own absolute step`,
        ).toBeLessThanOrEqual(1.5);
        if (mode === "dark") {
          expect(
            deltaE(over(veil, page), r.steps[2] as string),
            `${name}: alpha elevation separated --popover from --muted`,
          ).toBeLessThan(4);
        }
      }
    }
  });
});

describe("the bindings that are measured rather than written", () => {
  it("reads `boundary` off the ramp instead of hard-coding a step", () => {
    // The finding that had to reach the table. WCAG 1.4.11 asks 3:1 of a control's boundary, and
    // which step first delivers it is seed-dependent: measured, `#2b7fff` reaches it at 8 in dark
    // while `#e7000b` needs 9. A table writing `--ring: step 8` would be correct for one tenant and
    // 2.3:1 for the next, and nothing in the system would say so.
    expect(deriveRamp("#2b7fff", "dark").boundary).toBe(8);
    expect(deriveRamp("#e7000b", "dark").boundary).toBe(9);

    for (const mode of MODES) {
      const values = valuesOf(mode);
      for (const [token, ramp] of [
        ["--ring", "brand"],
        ["--sidebar-ring", "brand"],
        ["--input", "neutral"],
      ] as const) {
        const it = RAMPS[ramp][mode];
        expect(values[token], `${token} ${mode}`).toBe(it.steps[it.boundary - 1]);
        expect(
          contrast(values[token] as string, it.steps[0] as string),
          `${token} ${mode} misses 1.4.11`,
        ).toBeGreaterThanOrEqual(CONTRAST_MIN);
      }
    }
  });

  it("takes on-fill ink from the ramp's own measurement, with no white-when-legal escape hatch", () => {
    // The `text-white` defect, as a binding. On-fill text used to be a literal in two components
    // and failed AA on every status fill, worst at 2.13, because no token meant nothing to measure.
    // The accepted consequence is dark ink on some status fills — that is what "whatever measures
    // highest" costs, and it is cheaper than the alternative.
    for (const mode of MODES) {
      const values = valuesOf(mode);
      for (const [token, ramp] of [
        ["--primary-foreground", "brand"],
        ["--destructive-content", "destructive"],
        ["--warning-content", "warning"],
      ] as const) {
        expect(values[token], `${token} ${mode}`).toBe(RAMPS[ramp][mode].onSolid);
      }
      expect(values["--warning-content"], mode).not.toBe("#ffffff");
    }
  });

  it("sends a brand fill to the ink when the ramp carries no identity", () => {
    // Kanzo's own seed, and the defect that forced the rule: `#737373` is achromatic, so `(brand, 9)`
    // compiled `--primary` to `#737373` in *both* modes — every primary button in the system a
    // mid-grey. Step 9 is where a fill reads as a shape by hue; with no hue it reads by a *middle*
    // lightness, which is the weakest signal on the only channel left. So the emphasis goes to the
    // extreme, which is step 12.
    for (const mode of MODES) expect(GREY[mode].hue, mode).toBeNull();
    expect(fillStep(GREY)).toBe(RAMP_LENGTH);
    for (const mode of MODES) {
      const brand = GREY[mode];
      const values = greyValues(mode);
      for (const token of ["--primary", "--sidebar-primary"]) {
        expect(values[token], `${token} ${mode}`).toBe(brand.steps[RAMP_LENGTH - 1]);
        expect(values[token], `${token} ${mode} is still the mid-grey`).not.toBe(brand.steps[8]);
      }
      // The ink follows the step the fill actually landed on. It is step 1 by construction and not by
      // a second implementation of the ink rule: step 12 against itself is 1:1, so the ramp's own
      // extremes leave one candidate, and step 1 against step 12 is `strong-text-on-page` at 7:1.
      for (const token of ["--primary-foreground", "--sidebar-primary-foreground"]) {
        expect(values[token], `${token} ${mode}`).toBe(brand.steps[0]);
        expect(
          contrast(values[token] as string, values["--primary"] as string),
          `${token} ${mode} ink on fill`,
        ).toBeGreaterThanOrEqual(TEXT_MIN);
      }
      expect(
        contrast(values["--primary"] as string, values["--background"] as string),
        `${mode} fill on page`,
      ).toBeGreaterThanOrEqual(CONTRAST_MIN);
    }
  });

  it("leaves a chromatic brand exactly where it was", () => {
    // The regression that would be silent and expensive: every branded client's primary moving one
    // step. `RAMPS` is seeded `#7f22fe`, whose step 9 carries chroma well above the floor.
    expect(fillStep(RAMPS.brand)).toBe(SOLID_STEP);
    for (const mode of MODES) {
      const brand = RAMPS.brand[mode];
      const values = valuesOf(mode);
      expect(brand.relief.map((r) => r.id), mode).not.toContain(IDENTITY_RELIEF);
      for (const token of ["--primary", "--sidebar-primary"]) {
        expect(values[token], `${token} ${mode}`).toBe(brand.steps[SOLID_STEP - 1]);
      }
      for (const token of ["--primary-foreground", "--sidebar-primary-foreground"]) {
        expect(values[token], `${token} ${mode}`).toBe(brand.onSolid);
      }
    }
  });

  it("keeps a weak hue on step 9 — the relief is not the trigger", () => {
    // The defect this catches: `fillStep` used to fire on the `carries-identity` relief, and that
    // relief covers TWO of the ramp's three regimes — noise *and* tint. It grades step 9 against
    // `CHROMA_FLOOR` (0.1) where `deriveRamp` keeps a hue from `TINT_FLOOR` (0.0035) up, so every
    // weakly chromatic brand was handed the monochrome rule. Nord's `#88c0d0` is the case that found
    // it: step 9 carries chroma 0.063 at hue 217.5 — recognisably blue — and `--primary` compiled to
    // `#001016` in light and `#dcf1f7` in dark. `hue === null` is precisely the noise regime.
    const nord = { light: deriveRamp("#88c0d0", "light"), dark: deriveRamp("#88c0d0", "dark") };
    for (const mode of MODES) {
      // It still reports the relief. That is the whole point: the report is true and the fill rule
      // was reading it to answer a question it does not ask.
      expect(nord[mode].relief.map((r) => r.id), mode).toContain(IDENTITY_RELIEF);
      expect(nord[mode].hue, mode).toBeCloseTo(217.47, 2);
    }
    expect(fillStep(nord)).toBe(SOLID_STEP);

    const ramps = { ...RAMPS, brand: nord } as RampSet;
    for (const mode of MODES) {
      const values = Object.fromEntries(
        resolveRoles(ramps, CATEGORICAL(CHART_SLOTS), mode).map((r) => [r.token, r.value]),
      );
      expect(values["--primary"], mode).toBe(nord[mode].steps[SOLID_STEP - 1]);
      expect(values["--primary"], `${mode} took the monochrome rule`).not.toBe(
        nord[mode].steps[RAMP_LENGTH - 1],
      );
      expect(values["--primary-foreground"], mode).toBe(nord[mode].onSolid);
    }
    expect(oklch(nord.light.steps[SOLID_STEP - 1] as string).c).toBeGreaterThan(0.05);
  });

  it("reads a field the two modes cannot disagree about", () => {
    // Asserted rather than assumed, because `fillStep` reads the *pair* and a disagreement would be
    // silently resolved here. `carries-identity` grades the gamut-mapped step 9, which is solved per
    // mode, and it genuinely does disagree — 86 of these 14,760 seeds, `#110841` among them, which
    // read per mode gives a tenant a near-black primary in one mode and a mid-hue one in the other.
    // `hue` is read off the seed before either solve, so it cannot: 0 of 14,760.
    let hueDisagree = 0;
    let reliefDisagree = 0;
    let seeds = 0;
    for (let l = 0.2; l <= 0.9001; l += 0.05) {
      for (let c = 0; c <= 0.20001; c += 0.005) {
        for (let h = 0; h < 360; h += 15) {
          const seed = toHex(l, c, h);
          const light = deriveRamp(seed, "light");
          const dark = deriveRamp(seed, "dark");
          seeds++;
          if (light.hue !== dark.hue) hueDisagree++;
          const carries = (r: typeof light) => r.relief.some((x) => x.id === IDENTITY_RELIEF);
          if (carries(light) !== carries(dark)) reliefDisagree++;
        }
      }
    }
    expect(seeds).toBe(14760);
    expect(hueDisagree, "the seed hue disagreed across modes").toBe(0);
    expect(reliefDisagree, "the relief has stopped straddling — re-check the trigger").toBe(86);

    // The straddle case itself, now settled by a field that never straddles.
    const straddle = { light: deriveRamp("#110841", "light"), dark: deriveRamp("#110841", "dark") };
    const carries = (mode: Mode) => straddle[mode].relief.some((r) => r.id === IDENTITY_RELIEF);
    expect(carries("light")).not.toBe(carries("dark"));
    expect(straddle.light.hue).toBe(straddle.dark.hue);
    expect(fillStep(straddle)).toBe(SOLID_STEP);
    // ~12 s: 29,520 ramps. The grid is the one `fillStep`'s docblock quotes, so the claim and the
    // measurement cannot drift apart.
  }, 30_000);

  it("does not move the ring, which owes visibility and not maximum", () => {
    // The scope line. `--ring` is `(brand, boundary)` for a grey brand as for any other: 1.4.11 asks
    // 3:1 of a control's boundary, and for `#737373` the ramp answers step 9 at ~4.5 on the page.
    // A ring at step 12 would be a black outline claiming to be the brand.
    for (const mode of MODES) {
      const brand = GREY[mode];
      const values = greyValues(mode);
      for (const token of ["--ring", "--sidebar-ring"]) {
        expect(values[token], `${token} ${mode}`).toBe(brand.steps[brand.boundary - 1]);
        expect(
          contrast(values[token] as string, values["--background"] as string),
          `${token} ${mode} misses 1.4.11`,
        ).toBeGreaterThanOrEqual(CONTRAST_MIN);
      }
    }
  });

  it("recedes `--field` from every surface it can sit in, rather than tinting it", () => {
    // The 23 `bg-input/NN` sites, replaced by the thing they were approximating — but a field is a
    // *well*, and which value cuts one is a measurement, not a step. In light an alpha step recedes
    // (it is solved to composite onto its solid over step 1, where `bg-x/60` dilutes the *solid* and
    // lands wherever the backdrop puts it); in dark every alpha step composites LIGHTER than its
    // ground, so `a3` raised the field and took `--faint` below AA. See `recessFill`.
    for (const mode of MODES) {
      const values = valuesOf(mode);
      const field = values["--field"] as string;
      const page = values["--background"] as string;

      // Never lighter than the page — the whole obligation, stated as the direction it is about.
      expect(oklch(over(field, page)).l, `${mode} --field does not recede from the page`)
        .toBeLessThanOrEqual(oklch(page).l);

      // Where a transparency still recedes it is kept, and it is still the a3 solved onto `--muted`.
      if (field.length === 9) {
        expect(
          deltaE(over(field, page), values["--muted"] as string),
          `${mode} --field does not composite to --muted`,
        ).toBeLessThanOrEqual(1.5);
      } else {
        expect(field, `${mode} --field is neither a transparency nor the page`).toBe(page);
      }
    }
  });

  it("keeps `--faint` at AA on a field, on every surface a field can sit in", () => {
    // The measurement that moved `--field`. `--faint` is placeholder and gutter ink, so a field is
    // the one backdrop it MUST clear — and before this it read 4.49 on the page, 4.37 on a card and
    // 4.13 in a popover. The popover row is the one that proves it was not the fill's fault: with
    // the fill removed entirely (a1, byte 0) it was still 4.41, because a dark popover is step 3.
    for (const mode of MODES) {
      const values = valuesOf(mode);
      const field = values["--field"] as string;
      for (const surface of ["--background", "--card", "--popover", "--sidebar"] as const) {
        const under = values[surface] as string;
        expect(
          contrast(values["--faint"] as string, over(field, under)),
          `${mode} --faint on a field over ${surface}`,
        ).toBeGreaterThanOrEqual(TEXT_MIN);
      }
    }
  });
});

describe("the three tokens that used to be the same colour", () => {
  it("gives normal, hover and active three different surfaces", () => {
    // `--muted`, `--secondary` and `--accent` ship byte-identical — all three are
    // `color-mix(neutral-950 6%, background)` — because nothing ever forced them to differ. Steps
    // 3/4/5 are one component's normal, hover and active, and a hover a user cannot see is not a
    // hover.
    for (const mode of MODES) {
      const values = valuesOf(mode);
      const [muted, secondary, accent] = ["--muted", "--secondary", "--accent"].map(
        (t) => values[t] as string,
      ) as [string, string, string];
      expect(new Set([muted, secondary, accent]).size, mode).toBe(3);
      expect(deltaE(muted, secondary), `${mode} 3→4`).toBeGreaterThanOrEqual(2);
      expect(deltaE(secondary, accent), `${mode} 4→5`).toBeGreaterThanOrEqual(2);
    }
  });

  it("moves the border clear of the hover surface it used to be", () => {
    // Measured, today's `--border` is step 5 in both modes (`#dddddd` at ΔE 1.22 light, `#272727` at
    // ΔE 0.41 dark). With `--accent` taking step 5 they would be the same colour by the ramp's own
    // `interchangeable` bound — a border indistinguishable from the surface it encloses.
    for (const mode of MODES) {
      const values = valuesOf(mode);
      expect(
        deltaE(values["--accent"] as string, values["--border"] as string),
        `${mode} border reads as the hover surface`,
      ).toBeGreaterThan(4);
    }
  });
});

describe("chart slots past the set's capacity", () => {
  it("fold to the muted role rather than borrowing a colour", () => {
    // `capacity` is how many categories the set can honestly name. A seventh series taking whatever
    // `:root` happened to hold is the failure this replaces — and the leftovers stay a *reference*,
    // the one value in the sheet that is not a literal, so they cannot drift from the muted ink they
    // are supposed to be.
    const values = valuesOf("light", 5);
    for (let i = 1; i <= 5; i++) expect(values[`--chart-${i}`]).toMatch(/^#[0-9a-f]{6}$/);
    for (let i = 6; i <= CHART_SLOTS; i++) expect(values[`--chart-${i}`], `slot ${i}`).toBe(OTHER);
  });
});

describe("resolution as a whole", () => {
  it("gives every token a value in both modes", () => {
    for (const mode of MODES) {
      const resolved = resolveRoles(RAMPS, CATEGORICAL(CHART_SLOTS), mode);
      expect(resolved).toHaveLength(ROLES.length);
      for (const role of resolved) {
        expect(role.value, `${role.token} ${mode}`).toMatch(/^(#[0-9a-f]{6}([0-9a-f]{2})?|var\(--[a-z-]+\))$/);
      }
    }
  });

  it("is a pure function of the ramps it is given", () => {
    // It runs once, at derivation time, and its output is what gets stored. If it read anything
    // ambient, two derivations of the same seeds would disagree and the stored document would be a
    // snapshot of a machine rather than of a palette.
    const a = resolveRoles(RAMPS, CATEGORICAL(4), "dark");
    const b = resolveRoles(rampsFor("#7f22fe", "#6e737b"), CATEGORICAL(4), "dark");
    expect(a).toEqual(b);
  });
});
