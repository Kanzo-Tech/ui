import { describe, expect, it } from "vitest";
import { BASE16_SLOTS, paletteData } from "./index.js";
import { OTHER } from "./roles.js";

describe("@kanzo-tech/palette generated tables", () => {
  it("exports them from the JS entry", () => {
    // Not via a raw `.json` import: that is an ESM JSON import at runtime, which Node rejects
    // without `with { type: "json" }` — an attribute Rollup strips when bundling.
    expect(Object.keys(paletteData.ramps).length).toBeGreaterThan(0);
    expect(Object.keys(BASE16_SLOTS).length).toBeGreaterThan(0);
  });

  describe("the default categorical scheme", () => {
    // Still data rather than an axis: it is the answer for the one tenant that has no hue to spin a
    // wheel from — a brand below the chroma floor, which is Kanzo's own.
    const tokens = paletteData.schemes.kanzo.light.length;

    it("fills every token, whatever a scheme's capacity", () => {
      // A shorter scheme that left the tail undefined would fall back to whatever `:root` held, so
      // a chart with more series than the scheme names would mix two schemes and nothing would say
      // so.
      for (const [name, scheme] of Object.entries(paletteData.schemes)) {
        expect(scheme.light, name).toHaveLength(tokens);
        expect(scheme.dark, name).toHaveLength(tokens);
      }
    });

    it("says how many of those are real, and folds the rest to Other", () => {
      for (const [name, scheme] of Object.entries(paletteData.schemes)) {
        expect(scheme.slots, name).toBeLessThanOrEqual(tokens);
        for (const mode of ["light", "dark"] as const) {
          for (const hex of scheme[mode].slice(scheme.slots)) expect(hex).toBe(OTHER);
          for (const hex of scheme[mode].slice(0, scheme.slots)) expect(hex).not.toBe(OTHER);
        }
      }
    });

    it("is a name the derivation can actually resolve", () => {
      expect(paletteData.schemes).toHaveProperty(paletteData.defaultScheme);
    });
  });

  /**
   * The named greys a base seed can be picked from. Generated, because hand-writing them is how
   * they rot: the panel carried Tailwind **v3** hexes while the theme resolved v4, so every swatch
   * and the thing it stood for had quietly become different colours.
   */
  describe("base swatches", () => {
    it("are real hex, not the wreckage of a failed conversion", () => {
      // Tailwind writes achromatic steps as `oklch(55.6% 0 none)`. Parsed naively that hue is NaN,
      // and NaN rides all the way to a `#NaNNaNNaN` swatch instead of failing anywhere useful.
      const broken = Object.entries(paletteData.baseSwatches).filter(
        ([, hex]) => !/^#[0-9a-f]{6}$/.test(hex),
      );
      expect(broken, `not hex: ${JSON.stringify(broken)}`).toEqual([]);
    });

    it("include the one the derivation itself reads", () => {
      // `derive-palette.ts` uses `neutral` as the lightness for a neutral constructed from a brand
      // hue, and it is the Kanzo document's own base seed. Losing it is not a missing swatch, it
      // is a derivation with no neutral to fall back to.
      expect(paletteData.baseSwatches.neutral).toMatch(/^#[0-9a-f]{6}$/);
      expect(paletteData.seeds.kanzo.base).toBe(paletteData.baseSwatches.neutral);
    });
  });
});
