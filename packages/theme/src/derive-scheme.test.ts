import { describe, expect, it } from "vitest";
import {
  allPairsCap,
  deriveOrderedScheme,
  deriveScheme,
  leadingClear,
  familyOf,
  orderScheme,
} from "./derive-scheme.js";
import { SCHEMES } from "./index.js";
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
    it(`turns Dracula's hues into legal values in ${mode}, without judging their order`, () => {
      // The contract this asserts changed deliberately. It used to demand that the *derivation*
      // pass `checkScheme`, which asks whether neighbours are far enough apart — a question about
      // an arrangement `deriveScheme` does not make. Honouring it meant the answer depended on the
      // sequence the source happened to be written in. What this stage owes is band and chroma,
      // both properties of a value; separation is `deriveOrderedScheme`'s to answer, below.
      const { colours, dropped } = deriveScheme(DRACULA, mode);
      expect(dropped).toEqual([]);
      expect(colours).toHaveLength(DRACULA.length);
      const report = checkScheme(colours, { mode });
      expect(report.band).toEqual([]);
      expect(report.chroma).toEqual([]);
    });
  }

  it("does not care what order the source was written in", () => {
    // The bug, as a test. base16 lists its accents around the hue wheel, so every adjacent pair is
    // a hue neighbour — and in the dark band no hue-neighbour pair can reach the separation floor
    // at any step. With the gate applied here, the same six colours derived or refused depending
    // only on their spelling.
    const wheel = ["#ff5555", "#ffb86c", "#f1fa8c", "#50fa7b", "#bd93f9", "#ff79c6"];
    const shuffled = ["#50fa7b", "#ffb86c", "#ff79c6", "#bd93f9", "#ff5555", "#f1fa8c"];
    expect(deriveScheme(wheel, "dark").colours).toHaveLength(6);
    expect(deriveScheme(shuffled, "dark").colours).toHaveLength(6);
  });

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

describe("the pipeline against what we ship", () => {
  for (const mode of ["light", "dark"] as const) {
    it(`re-derives the default scheme's own families to something no worse in ${mode}`, () => {
      // A round trip: take the shipped slots, recover the families they came from, and let the
      // pipeline choose steps and order again. If the hand-run derivation and the function
      // disagree, one of them is wrong — and this is the test that says which.
      const shipped = (SCHEMES.kanzo as { light: string[]; dark: string[] })[mode];
      const { ordered, dropped } = deriveOrderedScheme(shipped, mode, { avoid: ["#fb2c36"] });
      expect(dropped).toEqual([]);

      // Through `deriveOrderedScheme`, not the two stages by hand. Running them by hand is what
      // this test used to do, and it is exactly the composition that was wrong: the step-chooser
      // ranks on a lower bound, so ordering only its leader can lose to a runner-up that arranges
      // better. Composed properly the round trip clears the shipped scheme again.
      expect(checkScheme(ordered, { mode }).ok).toBe(true);
      expect(checkScheme(ordered, { mode }).cvd.delta).toBeGreaterThanOrEqual(
        checkScheme(shipped, { mode }).cvd.delta,
      );
    });
  }
});

describe("deriveOrderedScheme", () => {
  /**
   * The palettes as base16 writes them: accents around the hue wheel. This is the input the whole
   * anti-corruption layer exists to serve, and the input the old composition could not handle.
   */
  const DRACULA_WHEEL = ["#ff5555", "#ffb86c", "#f1fa8c", "#50fa7b", "#bd93f9", "#ff79c6"];

  for (const mode of ["light", "dark"] as const) {
    it(`arranges a hue-wheel palette into a passing scheme in ${mode}`, () => {
      // The regression this whole change is about. Hand-composed, dark returned `[]` for five of
      // six palettes — not because their colours were unusable, but because base16 lists them in
      // the one order the adjacent gate cannot survive.
      const { ordered } = deriveOrderedScheme(DRACULA_WHEEL, mode, { avoid: ["#fb2c36"] });
      expect(ordered).toHaveLength(DRACULA_WHEEL.length);
      expect(checkScheme(ordered, { mode }).ok).toBe(true);
    });
  }

  it("beats the arrangement of the sequence it was handed", () => {
    // Ordering is not cosmetic: it is the colour-blindness mechanism. If the composed pipeline did
    // not improve on the input sequence there would be no reason for the stage to exist.
    const { colours, ordered } = deriveOrderedScheme(DRACULA_WHEEL, "dark", { avoid: ["#fb2c36"] });
    expect(checkScheme(ordered, { mode: "dark" }).cvd.delta).toBeGreaterThan(
      checkScheme(colours, { mode: "dark" }).cvd.delta,
    );
  });

  it("refuses honestly when nothing can be arranged", () => {
    // A refusal must still be reachable — moving the gate must not have made the layer incapable
    // of saying no. Two greys yield no families at all.
    const { ordered, colours } = deriveOrderedScheme(["#737373", "#8a8a8a"], "light");
    expect(colours).toEqual([]);
    expect(ordered).toEqual([]);
  });

  it("cannot rescue Nord, and says so", () => {
    // Seven of eight of Nord's accents sit below the chroma floor. One colour is not a categorical
    // palette, and the fix to the composition must not paper over that.
    const { ordered, dropped } = deriveOrderedScheme(NORD, "dark", { avoid: ["#fb2c36"] });
    expect(dropped.length).toBeGreaterThanOrEqual(NORD.length - 2);
    expect(ordered).toEqual([]);
  });
});

describe("the gates refuse a degenerate scheme", () => {
  it("does not pass a single colour", () => {
    // With one colour there are no pairs, so every separation check passed vacuously and both
    // worst-pair searches reported `Infinity`. Nord — whose eight accents leave exactly one above
    // the chroma floor — therefore reported a *passing scheme*.
    const one = checkScheme(["#2b7fff"], { mode: "light" });
    expect(one.cvd.delta).toBe(Number.POSITIVE_INFINITY);
    expect(one.ok).toBe(false);
    expect(checkScheme([], { mode: "light" }).ok).toBe(false);
    expect(checkScheme(["#2b7fff", "#008236"], { mode: "light" }).ok).toBe(true);
  });
});

describe("orderScheme's leading constraint", () => {
  it("asks for no more leading slots than the input can supply", () => {
    // `leading` is a constant, and for a small scheme it can be arithmetically impossible: if two
    // of five slots sit within ΔE 15 of --destructive, only three may lead, so demanding four
    // demands nothing. That returned `[]`, which reads as "this palette cannot be ordered" — a
    // much more alarming claim than "it has fewer than four slots that can lead".
    const near = "#ec003f"; // a rose, ΔE < 15 from red-500
    const scheme = [near, "#2b7fff", "#008236", "#a65f00"];
    expect(orderScheme(scheme, "light", { avoid: ["#fb2c36"], leading: 4 })).toHaveLength(4);
  });
});

describe("the avoid constraint degrades instead of refusing", () => {
  const DRACULA_WHEEL = ["#ff5555", "#ffb86c", "#f1fa8c", "#50fa7b", "#bd93f9", "#ff79c6"];

  it("keeps a scheme that cannot hold every leading slot clear", () => {
    // `avoid` is a preference; the checks are the law. Conflating them refused three of the six
    // palettes outright — and each of them ordered fine in both modes with `avoid` dropped, so the
    // separation gate was never what failed. A refusal that says "these colours cannot be told
    // apart" when the truth is "slot 3 sits near red" is worse than no answer.
    const { ordered, leading } = deriveOrderedScheme(DRACULA_WHEEL, "light", {
      avoid: ["#fb2c36"],
      leading: 4,
    });
    expect(ordered).toHaveLength(DRACULA_WHEEL.length);
    expect(leading).toBeLessThanOrEqual(4);
    // Whatever it managed, the slots it claims are clear really are.
    for (const hex of ordered.slice(0, leading)) {
      expect(deltaE(hex, "#fb2c36")).toBeGreaterThanOrEqual(15);
    }
  });

  it("still holds as many as the colours allow, not as few as it can get away with", () => {
    const relaxed = deriveOrderedScheme(DRACULA_WHEEL, "light", { avoid: ["#fb2c36"], leading: 4 });
    const none = deriveOrderedScheme(DRACULA_WHEEL, "light", { leading: 0 });
    expect(relaxed.leading).toBeGreaterThan(leadingClear(none.ordered, ["#fb2c36"]) - 1);
  });
});
