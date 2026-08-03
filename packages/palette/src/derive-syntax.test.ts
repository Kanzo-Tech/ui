import { describe, expect, it } from "vitest";
import paletteData from "../palette-data.json";
import {
  SYNTAX_BAND,
  SYNTAX_ROLES,
  SYNTAX_SEPARATION,
  deriveSyntax,
} from "./derive-syntax.js";
import { DEFAULT_SYNTAX_SOURCE, fromBase16, fromHexes, fromVsCode, seedsFor } from "./syntax-source.js";
import { TEXT_MIN, contrast, deltaE, oklch, type Mode } from "./palette-check.js";
import { deriveRamp } from "./ramp.js";

/**
 * Syntax was the last corner of this system that was not derived — thirteen literal hexes copied
 * from one base16 palette, so all six shipped documents declared the same keywords. What these
 * measure is the four obligations that replaced the copying, and the two constants that came out of
 * the corpus rather than out of anyone's judgement.
 */

const MODES = ["light", "dark"] as const;

/** Three bases a tenant plausibly has: Kanzo's grey, a tinted one, and a blue-ish one. */
const BASES = {
  kanzo: "#737373",
  tinted: "#6e737b",
  slate: "#6b7280",
} as const;

const rampFor = (seed: string, mode: Mode) => deriveRamp(seed, mode);

/** The eight accent slots base16 defines; the seven roles read all but `base0F`. */
const ACCENTS = ["base08", "base09", "base0A", "base0B", "base0C", "base0D", "base0E"];
const PALETTES = paletteData.palettes as unknown as Record<string, { slots: Record<string, string> }>;

describe("the constants that came out of the corpus", () => {
  it("puts SYNTAX_BAND around every accent slot the shipped palettes actually use", () => {
    // The band is a measurement, not a taste: light sources land at L 0.488–0.714 and dark ones at
    // 0.606–0.955. If a new palette is added whose slots fall outside, the band is what should move
    // — and this is what would say so, rather than the derivation quietly clamping every slot.
    const light = ["kanzo", "catppuccin-latte"];
    const dark = ["kanzo-dark", "dracula", "nord", "catppuccin-mocha"];
    for (const [mode, ids] of [["light", light], ["dark", dark]] as const) {
      const ls = ids.flatMap((id) => ACCENTS.map((slot) => oklch(PALETTES[id]?.slots[slot] as string).l));
      const [lo, hi] = SYNTAX_BAND[mode];
      expect(Math.min(...ls), `${mode} floor`).toBeGreaterThanOrEqual(lo);
      expect(Math.max(...ls), `${mode} roof`).toBeLessThanOrEqual(hi);
    }
  });

  it("sets SYNTAX_SEPARATION under the closest pair any shipped scheme actually ships", () => {
    // **The first draft said 8 and rejected Kanzo's own light set.** `identifier` `#c10007` against
    // `number` `#ca3500` measures 5.4, so the rule collapsed `identifier` onto the page ink — a set
    // that has shipped for months. A bar that fails the corpus it was derived from is measuring the
    // wrong thing.
    const worst = Object.keys(PALETTES).map((id) => {
      const values = ACCENTS.map((slot) => PALETTES[id]?.slots[slot] as string);
      let least = Infinity;
      for (let i = 0; i < values.length; i++) {
        for (let j = i + 1; j < values.length; j++) {
          least = Math.min(least, deltaE(values[i] as string, values[j] as string));
        }
      }
      return least;
    });
    expect(SYNTAX_SEPARATION).toBeLessThanOrEqual(Math.min(...worst));
  });
});

describe("the obligations", () => {
  it("keeps every role at AA on the active line, for every base and every source", () => {
    // The ground is base step 3 and not step 1, which is the whole correction: it is darker than the
    // page in light and lighter in dark, so it eats contrast either way, and grading against it
    // covers the page for free. The gate that shipped measured the page, and `type` reached
    // production at 4.30:1 on a line being edited.
    for (const base of Object.values(BASES)) {
      for (const id of ["kanzo", "dracula", "nord", "catppuccin-mocha"]) {
        for (const mode of MODES) {
          const ramp = rampFor(base, mode);
          const { values } = deriveSyntax(fromBase16(id, mode), ramp, mode);
          for (const role of SYNTAX_ROLES) {
            expect(
              contrast(values[role], ramp.steps[2] as string),
              `${id}/${base}/${mode}/${role}`,
            ).toBeGreaterThanOrEqual(TEXT_MIN);
          }
        }
      }
    }
  });

  it("never lets a role outshout the page's own ink", () => {
    // Code is the content; highlighting structures it. A syntax colour with more contrast than
    // `--foreground` would make the keywords louder than the code.
    for (const mode of MODES) {
      const ramp = rampFor(BASES.kanzo, mode);
      const { values } = deriveSyntax(seedsFor(DEFAULT_SYNTAX_SOURCE, mode), ramp, mode);
      const ink = contrast(ramp.steps[11] as string, ramp.steps[2] as string);
      for (const role of SYNTAX_ROLES) {
        expect(contrast(values[role], ramp.steps[2] as string), `${mode}/${role}`).toBeLessThanOrEqual(ink);
      }
    }
  });

  it("reports capacity instead of recycling another role's colour", () => {
    // Nord read onto a light page collapses: it is a low-contrast pastel scheme that only ever
    // existed in dark. What matters is that the roles that collapse fall to the **ink** — never to a
    // sibling's hue, which would claim a distinction the set cannot make. Same rule `OTHER` imposes
    // on a ninth chart slot.
    const ramp = rampFor(BASES.kanzo, "light");
    const derived = deriveSyntax(fromBase16("nord", "light"), ramp, "light");
    expect(derived.capacity).toBeLessThan(SYNTAX_ROLES.length);
    const collapsed = SYNTAX_ROLES.filter((role) => derived.values[role] === ramp.steps[11]);
    expect(collapsed.length).toBe(SYNTAX_ROLES.length - derived.capacity);
    expect(derived.relief.filter((r) => r.id === "distinct")).toHaveLength(collapsed.length);
  });
});

describe("a seed decides the value, and an obligation only moves it when it bites", () => {
  it("leaves a scheme authored for this mode exactly as its author wrote it", () => {
    // The gate policy the whole package runs on, applied here: `deriveRamp` does not invent step 9,
    // and this does not invent a keyword. Kanzo's dark set comes back byte-identical, which is the
    // property that made this change safe to ship — the editor most people are looking at does not
    // move at all.
    const ramp = rampFor(BASES.kanzo, "dark");
    const { values, adjustments } = deriveSyntax(fromBase16("kanzo", "dark"), ramp, "dark");
    expect(adjustments).toEqual([]);
    expect(values.keyword).toBe(PALETTES["kanzo-dark"]?.slots.base0E);
    expect(values.string).toBe(PALETTES["kanzo-dark"]?.slots.base0B);
  });

  it("reads a dark-only scheme onto a light page instead of transcribing it", () => {
    // "Keep the hue, lose the mood" — the same treatment `seeds.ts` gives a foreign brand seed.
    //
    // The spread is the part worth measuring, and it is what a first draft got wrong: clamping every
    // out-of-band slot to the band's roof put all seven of Dracula's colours at the AA floor, which
    // is one colour with seven hues. Mapping the source band onto the target band keeps the
    // structure its author built.
    const ramp = rampFor(BASES.kanzo, "light");
    const { values } = deriveSyntax(fromBase16("dracula", "light"), ramp, "light");
    const ratios = SYNTAX_ROLES.map((role) => contrast(values[role], ramp.steps[2] as string));
    expect(Math.max(...ratios) - Math.min(...ratios)).toBeGreaterThan(1);
    // Hue survives: Dracula's pink keyword is still pink-ish, not a generic legible violet.
    const hue = (hex: string) => oklch(hex).h;
    expect(Math.abs(hue(values.keyword) - hue("#ff79c6"))).toBeLessThan(25);
  });
});

describe("the adapters", () => {
  it("reads a VS Code theme through the scopes every grammar agrees on", () => {
    const seeds = fromVsCode(
      [
        { scope: "keyword", settings: { foreground: "#ff0000" } },
        { scope: ["string", "string.quoted"], settings: { foreground: "#00ff00" } },
        { scope: "comment", settings: { foreground: "#888888" } },
      ],
      "light",
    );
    expect(seeds.keyword).toBe("#ff0000");
    expect(seeds.string).toBe("#00ff00");
    // A scope the theme does not style falls back to Kanzo's seed rather than to nothing: a hole in
    // a syntax set renders as plain text, which reads as a bug in the editor rather than a gap in
    // the import. `comment` is not among the seven at all — it dissolved into `--faint`.
    expect(seeds.type).toBe(fromBase16("kanzo", "light").type);
  });

  it("takes seven hexes directly, for a client whose scheme is neither format", () => {
    const seeds = fromHexes({ keyword: "#123456" }, "dark");
    expect(seeds.keyword).toBe("#123456");
    expect(seeds.string).toBe(fromBase16("kanzo", "dark").string);
  });

  it("prefers a scheme's own dark half when it publishes one", () => {
    // base16 distributes the two halves under separate ids, which is how Kanzo's own arrive.
    expect(fromBase16("kanzo", "dark").keyword).toBe(PALETTES["kanzo-dark"]?.slots.base0E);
    expect(fromBase16("kanzo", "light").keyword).toBe(PALETTES.kanzo?.slots.base0E);
    // Dracula ships one half, so both modes read it and `SYNTAX_BAND` does the rest.
    expect(fromBase16("dracula", "light").keyword).toBe(PALETTES.dracula?.slots.base0E);
  });
});
