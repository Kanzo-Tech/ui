import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PALETTES, type Palette, type PaletteSlot, themeData } from "./index";
import { TEXT_MIN, contrast } from "./palette-check.js";

/**
 * A palette is data this package transcribes from somewhere else, which is the one category of
 * value no type can defend. These are the checks that stand in for that: the slots are complete,
 * the ramp runs the way base16 says it runs, the declared relief is the measured relief, and the
 * two projections of the `kanzo` pair — the generated CSS and `tokens.css`'s hand-written defaults
 * — say the same thing.
 */

const pkgDir = resolve(__dirname, "..");
const tokensCss = readFileSync(resolve(pkgDir, "tokens.css"), "utf8");

const NEUTRALS: PaletteSlot[] = ["base00", "base01", "base02", "base03", "base04", "base05"];
const ACCENTS: PaletteSlot[] = [
  "base08", "base09", "base0A", "base0B", "base0C", "base0D", "base0E", "base0F",
];
const SLOTS: PaletteSlot[] = [...NEUTRALS, "base06", "base07", ...ACCENTS];

const entries = Object.entries(PALETTES) as [string, Palette][];
const luminance = (hex: string) => contrast(hex, "#000000");

describe("palettes", () => {
  it("ships the pair the product defaults to", () => {
    expect(PALETTES[themeData.defaultPalette]).toBeDefined();
    expect(PALETTES[themeData.defaultPalette]?.appearance).toBe("light");
  });

  it("fills all sixteen slots with real hex", () => {
    for (const [name, palette] of entries) {
      for (const slot of SLOTS) {
        expect(palette.slots[slot], `${name}.${slot}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it("runs base00→base05 monotonically from background to ink", () => {
    // base16 orders the neutral ramp, and every consumer leans on that order: comments sit nearer
    // the background than punctuation, surfaces stack, and the light schemes are the same ordering
    // inverted. A palette transcribed out of order would still render — just wrongly, and quietly.
    for (const [name, palette] of entries) {
      const lums = NEUTRALS.map((slot) => luminance(palette.slots[slot]));
      const sorted = [...lums].sort((a, b) => (palette.appearance === "light" ? b - a : a - b));
      expect(lums, `${name} neutral ramp is not monotone`).toEqual(sorted);
    }
  });

  it("declares the appearance it renders, and CSS is told", () => {
    for (const [name, palette] of entries) {
      expect(palette.vars["color-scheme"], name).toBe(palette.appearance);
      // A light palette's background is light. Trivially true of a correct transcription and the
      // first thing to break in a wrong one.
      const bg = luminance(palette.slots.base00);
      const ink = luminance(palette.slots.base05);
      expect(palette.appearance === "light" ? bg > ink : ink > bg, name).toBe(true);
    }
  });

  it("pairs symmetrically, across appearances", () => {
    // Pairing is what the light/dark toggle folds into: the OS preference picks the partner rather
    // than inverting a mode. A one-way link would strand a palette the switcher could enter and
    // never leave.
    for (const [name, palette] of entries) {
      if (palette.pairsWith === null) continue;
      const partner = PALETTES[palette.pairsWith];
      expect(partner, `${name} pairs with "${palette.pairsWith}", which does not exist`).toBeDefined();
      expect(partner?.pairsWith, `${palette.pairsWith} does not pair back`).toBe(name);
      expect(partner?.appearance, `${name} pairs with its own appearance`).not.toBe(palette.appearance);
    }
  });

  describe("relief", () => {
    // Declared in the generator and re-measured here, the way a scheme's relief is. The threshold
    // is TEXT_MIN, not CONTRAST_MIN: every slot renders as text, so there is no relief channel to
    // trade contrast against.
    const measured = (palette: Palette) =>
      [...NEUTRALS.slice(3), ...ACCENTS].filter(
        (slot) => contrast(palette.slots[slot], palette.slots.base00) < TEXT_MIN,
      );

    it("is the measured list, for every palette", () => {
      for (const [name, palette] of entries) {
        expect(palette.relief, `${name} declares relief it does not have, or hides relief it does`)
          .toEqual(measured(palette));
      }
    });

    it("is empty for the pair the product ships as its default", () => {
      // A borrowed palette may be low-contrast — Nord's own comments are 1.7:1 — and saying so is
      // the whole point of publishing this. Ours has no such excuse.
      expect(PALETTES.kanzo?.relief).toEqual([]);
      expect(PALETTES["kanzo-dark"]?.relief).toEqual([]);
    });
  });

  describe("manufactured slots", () => {
    it("are only the two no palette documents", () => {
      for (const [name, palette] of entries) {
        for (const slot of palette.extended) {
          expect(["base06", "base07"], `${name} manufactured ${slot}`).toContain(slot);
        }
      }
    });

    it("never reach a token", () => {
      // base06/base07 are generated by carrying base05 toward the ink extreme, so they are this
      // package's invention rather than the palette's word. The surface math is written to read
      // base05 instead precisely so an invented value cannot end up in a border.
      for (const [name, palette] of entries) {
        const declared = new Set(
          SLOTS.filter((s) => !palette.extended.includes(s)).map((s) => palette.slots[s]),
        );
        for (const slot of palette.extended) {
          const hex = palette.slots[slot];
          if (declared.has(hex)) continue; // coincides with a real slot; nothing to attribute
          for (const [token, value] of Object.entries(palette.vars)) {
            expect(value, `${name}.${token} reads the manufactured ${slot}`).not.toContain(hex);
          }
        }
      }
    });
  });

  describe("syntax roles", () => {
    const roles = themeData.syntaxRoles as Record<string, PaletteSlot>;

    it("map every one of the thirteen onto a real slot", () => {
      expect(Object.keys(roles)).toHaveLength(13);
      for (const [role, slot] of Object.entries(roles)) {
        expect(SLOTS, `role "${role}" maps to ${slot}`).toContain(slot);
      }
    });

    it("are set by every palette, from its own slots", () => {
      for (const [name, palette] of entries) {
        for (const [role, slot] of Object.entries(roles)) {
          expect(palette.vars[`--kanzo-syntax-${role}`], `${name}.${role}`).toBe(palette.slots[slot]);
        }
      }
    });

    /**
     * `tokens.css` is hand-written, so its syntax block is a second copy of the `kanzo` pair with
     * nothing tying it to the first. The failure it guards is specific and silent: the block that
     * applies when no attribute is set would stop matching the palette of the same name, so
     * *selecting* Kanzo would recolour an editor that was already showing Kanzo.
     */
    it("match tokens.css, which is where they apply with no attribute set", () => {
      const blocks: [string, string][] = [
        ["kanzo", tokensCss.match(/^:root\s*\{([\s\S]*?)^\}/m)?.[1] ?? ""],
        ["kanzo-dark", tokensCss.match(/^\.dark\s*\{([\s\S]*?)^\}/m)?.[1] ?? ""],
      ];
      for (const [name, block] of blocks) {
        expect(block, `no block found for ${name}`).not.toBe("");
        const declared = new Map<string, string>();
        for (const m of block.matchAll(/^\s*(--kanzo-syntax-[a-z]+)\s*:\s*([^;]+);/gm)) {
          declared.set(m[1] as string, (m[2] as string).trim());
        }
        const palette = PALETTES[name] as Palette;
        const drifted: string[] = [];
        for (const role of Object.keys(roles)) {
          const token = `--kanzo-syntax-${role}`;
          const expected = palette.vars[token];
          const actual = declared.get(token);
          if (actual !== expected) drifted.push(`${token}: tokens.css ${actual ?? "(missing)"} ≠ ${expected}`);
        }
        expect(drifted, `tokens.css drifted from the ${name} palette:\n${drifted.join("\n")}`).toEqual([]);
      }
    });
  });

  it("has a generated block for every palette, at a specificity that beats the base scale", () => {
    // The block cannot be scoped under `.dark` — a palette carries its own appearance — which
    // leaves it at (0,1,0) against `.dark [data-base]` at (0,2,0). Doubling the attribute matches
    // specificity so source order can settle it, and source order puts palettes last.
    const themes = readFileSync(resolve(pkgDir, "themes.css"), "utf8");
    for (const [name] of entries) {
      expect(themes, `no doubled selector for palette "${name}"`)
        .toContain(`[data-palette="${name}"][data-palette="${name}"]`);
    }
    expect(themes.indexOf("[data-palette="), "palettes are emitted before the base scale")
      .toBeGreaterThan(themes.indexOf("[data-base="));
  });
});
