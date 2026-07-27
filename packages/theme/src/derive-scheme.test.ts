import { describe, expect, it } from "vitest";
import { allPairsCap, deriveScheme, familyOf, orderScheme } from "./derive-scheme.js";
import { checkScheme, deltaE } from "./palette-check.js";

/** Dracula's accents, minus the cyan that carries no usable hue. */
const DRACULA = ["#50fa7b", "#ffb86c", "#ff79c6", "#bd93f9", "#ff5555", "#f1fa8c"];
/** Nord's Aurora and Frost. Deliberately desaturated, which is the point of the test. */
const NORD = ["#bf616a", "#d08770", "#ebcb8b", "#a3be8c", "#b48ead", "#88c0d0"];

describe("familyOf", () => {
  it("matches on hue, where deltaE would not", () => {
    expect(familyOf("#bd93f9")).toBe("purple");
    expect(familyOf("#50fa7b")).toBe("green");
    expect(familyOf("#ff79c6")).toBe("pink");
    expect(familyOf("#ff5555")).toBe("red");
  });

  it("refuses a colour with no usable hue", () => {
    // Below the chroma floor the angle is float noise in a/b, not a colour worth matching.
    expect(familyOf("#8be9fd")).toBeNull();
    expect(familyOf("#737373")).toBeNull();
  });
});

describe("deriveScheme", () => {
  for (const mode of ["light", "dark"] as const) {
    it(`turns Dracula's hues into something that passes in ${mode}`, () => {
      const { colours, dropped } = deriveScheme(DRACULA, mode);
      expect(dropped).toEqual([]);
      expect(colours).toHaveLength(DRACULA.length);
      expect(checkScheme(colours, { mode }).ok).toBe(true);
    });
  }

  it("keeps the palette's hues and not its mood", () => {
    // The whole trade in one assertion: same families, different values. Dracula's green is a
    // pastel `#50fa7b`; the dark band forbids that for a mark, so the derivation lands far darker.
    const { colours, families } = deriveScheme(DRACULA, "dark");
    expect(families[0]).toBe("green");
    expect(colours[0]).not.toBe("#50fa7b");
  });

  it("still produces something recognisably not the default", () => {
    // Identity survives through the *family set*, which is what makes choosing a palette worth
    // anything: Dracula has no blue at all, and the default opens on one.
    expect(deriveScheme(DRACULA, "light").families).not.toContain("blue");
  });

  it("reports the colours it had to drop rather than quietly skipping them", () => {
    const { dropped } = deriveScheme([...DRACULA, "#8be9fd"], "light");
    expect(dropped).toEqual(["#8be9fd"]);
  });

  it("drops most of Nord, because a desaturated palette has no hues to give", () => {
    // Measured, and the reason nothing can be derived from Nord: its colours are barely chromatic.
    const { dropped } = deriveScheme(NORD, "dark");
    expect(dropped.length).toBeGreaterThanOrEqual(NORD.length - 2);
  });

  it("returns nothing at all rather than a palette that merely looks derived", () => {
    expect(deriveScheme(["#737373", "#8a8a8a"], "light").colours).toEqual([]);
  });
});

describe("orderScheme", () => {
  const derived = deriveScheme(DRACULA, "light").colours;

  it("returns an arrangement that clears every gate", () => {
    const ordered = orderScheme(derived, "light");
    expect(ordered).toHaveLength(derived.length);
    expect([...ordered].sort()).toEqual([...derived].sort());
    expect(checkScheme(ordered, { mode: "light" }).ok).toBe(true);
  });

  it("beats or matches the arrangement it was given", () => {
    // The order IS the colour-blindness mechanism — only neighbours are guaranteed to touch — so a
    // derivation that chose steps but left the sequence alone has left the gate half shut.
    const before = checkScheme(derived, { mode: "light" });
    const after = checkScheme(orderScheme(derived, "light"), { mode: "light" });
    expect(after.cvd.delta).toBeGreaterThanOrEqual(before.cvd.delta);
  });

  it("keeps the leading slots clear of a reserved status colour", () => {
    // `--destructive` is red-500. Without this the winner puts a red in slot 2, on the series
    // almost every chart uses, where it reads as an error rather than as data.
    const ordered = orderScheme(derived, "light", { avoid: ["#fb2c36"], leading: 4 });
    expect(ordered.length).toBeGreaterThan(0);
    for (const hex of ordered.slice(0, 4)) expect(deltaE(hex, "#fb2c36")).toBeGreaterThanOrEqual(15);
  });

  it("refuses a slot count it cannot enumerate", () => {
    expect(() => orderScheme(new Array(9).fill("#2b7fff"), "light")).toThrow(RangeError);
  });

  it("reports how many leading slots survive the all-pairs list", () => {
    const cap = allPairsCap(orderScheme(derived, "light"), "light");
    expect(cap).toBeGreaterThanOrEqual(2);
    expect(cap).toBeLessThanOrEqual(derived.length);
  });
});
