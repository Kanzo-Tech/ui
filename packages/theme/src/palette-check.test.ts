import { describe, expect, it } from "vitest";
import { SCHEMES } from "./index.js";
import {
  CHROMA_FLOOR,
  checkScheme,
  contrast,
  deltaE,
  hueDistance,
  oklch,
  SURFACE,
  type Mode,
} from "./palette-check.js";

const MODES: Mode[] = ["light", "dark"];

describe("colour maths", () => {
  it("agrees with the reference implementation on known values", () => {
    // Spot values, so a refactor of the conversions cannot drift silently. Chroma is measured off
    // the hex, not off Tailwind's declared `oklch(60.9% 0.126 …)`: cyan-600 is outside sRGB, so the
    // value that survives the round trip is 0.116 — and 0.116 is what the chroma floor judges.
    expect(oklch("#2b7fff").l).toBeCloseTo(0.623, 2);
    expect(oklch("#0092b8").c).toBeCloseTo(0.116, 2);
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 1);
  });

  it("matches a borrowed colour by hue, which deltaE cannot do", () => {
    // Dracula's purple against two candidate families. `deltaE` picks the wrong one because it
    // includes lightness and the palette is uniformly pastel; hue picks the right one.
    const dracPurple = oklch("#bd93f9").h;
    expect(hueDistance(dracPurple, oklch("#7f22fe").h)).toBeLessThan(
      hueDistance(dracPurple, oklch("#0084d1").h),
    );
    expect(deltaE("#bd93f9", "#0084d1")).toBeLessThan(deltaE("#bd93f9", "#7f22fe"));
  });

  it("gives a grey a hue that means nothing, and says so through chroma", () => {
    // `#737373` answers 89.9°, which is float noise in a/b rather than a colour. The chroma is what
    // tells you not to trust it — a fabricated 0 would read as an answer instead of an absence.
    expect(oklch("#737373").c).toBeLessThan(CHROMA_FLOOR);
  });

  it("measures the collapse simulated vision causes", () => {
    // Orange and green are far apart to full-colour vision and nearly the same under deuteranopia.
    // If this ever stops holding, the simulation is wrong, not the palette.
    expect(deltaE("#ffb86c", "#50fa7b")).toBeGreaterThan(20);
    expect(deltaE("#ffb86c", "#50fa7b", "deutan")).toBeLessThan(6);
  });
});

describe("every registered scheme", () => {
  for (const [name, scheme] of Object.entries(SCHEMES)) {
    for (const mode of MODES) {
      it(`${name} clears every hard gate in ${mode}`, () => {
        const report = checkScheme(scheme[mode], { mode });
        expect(report.band).toEqual([]);
        expect(report.chroma).toEqual([]);
        expect(report.cvd.state).not.toBe("fail");
        expect(report.normal.ok).toBe(true);
        expect(report.ok).toBe(true);
      });

      it(`${name} declares its ${mode} relief honestly`, () => {
        // The panel shows "needs labels" off this number. A scheme that quietly gained a sub-3:1
        // slot would keep claiming it asks nothing of the chart around it.
        expect(checkScheme(scheme[mode], { mode }).relief).toHaveLength(scheme.relief[mode]);
      });
    }

    it(`${name} gives both modes the same number of slots`, () => {
      expect(scheme.dark).toHaveLength(scheme.light.length);
    });
  }
});

describe("the gate actually bites", () => {
  it("fails the palette this replaced", () => {
    // The old `--chart-*` in light: two adjacent ambers and a near-grey. Encoded as a regression so
    // the checks cannot be loosened into accepting it again.
    const report = checkScheme(["#f54a00", "#009689", "#104e64", "#ffb900", "#fe9a00"], {
      mode: "light",
      surface: SURFACE.light,
    });
    expect(report.ok).toBe(false);
    expect(report.chroma).toContain("#104e64");
    expect(report.normal.delta).toBeLessThan(15);
  });

  it("fails a palette borrowed from a syntax theme", () => {
    // Dracula's accents, measured 2026-07-27: every one outside the dark band, because it is a
    // pastel-on-dark palette. This is why a named palette supplies hues to the derivation and never
    // its values — see the anti-corruption note in the scheme docs.
    const report = checkScheme(
      ["#8be9fd", "#50fa7b", "#ffb86c", "#ff79c6", "#bd93f9", "#ff5555", "#f1fa8c"],
      { mode: "dark", surface: "#282a36" },
    );
    expect(report.ok).toBe(false);
    expect(report.band).toHaveLength(7);
  });

  it("is stricter on the all-pairs list than on neighbours", () => {
    const kanzo = SCHEMES.kanzo as { light: string[] };
    const adjacent = checkScheme(kanzo.light, { mode: "light" });
    const all = checkScheme(kanzo.light, { mode: "light", pairs: "all" });
    expect(all.normal.delta).toBeLessThanOrEqual(adjacent.normal.delta);
  });
});
