import { describe, expect, it } from "vitest";
import {
  FAMILY_GAP,
  SEPARATION_BAR,
  allPairsCap,
  deriveOrderedScheme,
  deriveScheme,
  deriveSchemeColors,
  leadingClear,
  familyAtHue,
  familyOf,
  familyStandard,
  orderScheme,
} from "./derive-scheme.js";
import { BASE16_SLOTS, paletteData } from "./index.js";
import { CVD_TARGET, checkScheme, deltaE, oklch } from "./palette-check.js";

const SCHEMES = paletteData.schemes as unknown as Record<string, { light: string[]; dark: string[] }>;

/** Dracula's accents, minus the cyan that carries no usable hue. */
const DRACULA = ["#50fa7b", "#ffb86c", "#ff79c6", "#bd93f9", "#ff5555", "#f1fa8c"];
/** Nord's Aurora and Frost. Deliberately desaturated, which is the point of the test. */
const NORD = ["#bf616a", "#d08770", "#ebcb8b", "#a3be8c", "#b48ead", "#88c0d0"];
/** Catppuccin Latte's eight accents, as base16 writes them. Seven carry a usable hue. */
const LATTE = [
  "#d20f39",
  "#fe640b",
  "#df8e1d",
  "#40a02b",
  "#179299",
  "#1e66f5",
  "#8839ef",
  "#e64553",
];

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

  it("answers for an angle nothing occupies", () => {
    // A wheel spun off a brand hue asks about angles no source colour sits at, so the hue half of
    // the match has to exist without a colour to carry it. Same rule, same answer.
    for (const hex of ["#bd93f9", "#50fa7b", "#ff79c6", "#ff5555"]) {
      expect(familyAtHue(oklch(hex).h)).toBe(familyOf(hex));
    }
    // And it wraps, rather than treating 359° and 1° as the far ends of a line.
    expect(familyAtHue(361)).toBe(familyAtHue(1));
    expect(familyAtHue(-1)).toBe(familyAtHue(359));
  });

  it("stands a family up as a colour again", () => {
    // The round trip a wheel depends on: a family named from an angle has to come back as a colour
    // that lands on that same family, or the source would be asking for a family it does not name.
    for (const name of ["teal", "violet", "amber", "pink"]) {
      expect(familyOf(familyStandard(name))).toBe(name);
    }
    expect(() => familyStandard("burgundy")).toThrow(RangeError);
  });

  it("publishes how unevenly the families are spaced", () => {
    // The 17 families are not a regular polygon — yellow→lime is 61.8° and red→orange is 8.4° — and
    // that is why a wheel dedupes: at any spacing under the widest gap, two spokes can name one
    // family. A wheel that assumed 17 evenly spaced hues would silently ship duplicate slots.
    expect(FAMILY_GAP).toBeGreaterThan(60);
    expect(FAMILY_GAP).toBeLessThan(62);
    // Yellow spans 62.5°–102.4°, so two spokes 39° apart both land on it.
    expect(familyAtHue(63)).toBe("yellow");
    expect(familyAtHue(102)).toBe("yellow");
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
      const { ordered, dropped, crowded } = deriveOrderedScheme(shipped, mode, {
        avoid: ["#fb2c36"],
      });
      expect(dropped).toEqual([]);

      // And it keeps all eight. Subsetting exists to stop a palette from spending separation it
      // does not have; the scheme we ship chose its families by enumeration, so it has the
      // separation, and a rule that trimmed it anyway would be trimming on principle rather than
      // on measurement.
      expect(crowded).toEqual([]);
      expect(ordered).toHaveLength(shipped.length);

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
      //
      // This used to demand every source colour appear in the result, and that contract is gone
      // deliberately: a palette hands over the families it has, not the families it can keep apart,
      // and forcing all of them put Dracula's worst simulated pair at 7.2 against a target of 8.
      // What a derivation owes is a *legal* scheme and an honest count, not a full one.
      const { ordered, kept, crowded, dropped } = deriveOrderedScheme(DRACULA_WHEEL, mode, {
        avoid: ["#fb2c36"],
      });
      expect(ordered.length).toBeGreaterThanOrEqual(2);
      expect(checkScheme(ordered, { mode }).ok).toBe(true);
      expect(kept.length + crowded.length + dropped.length).toBe(DRACULA_WHEEL.length);
    });
  }

  it("names fewer categories rather than ones a colour-blind reader cannot separate", () => {
    // The hypothesis, as a test, on the palette that shows it most plainly. Forcing all seven of
    // Latte's usable families lands the worst adjacent pair at 8.3 in dark — a hundredth above the
    // pass mark, and only because `CVD_TARGET` is where it is. Five families reach 33.4.
    const forced = deriveOrderedScheme(LATTE, "dark", { avoid: ["#fb2c36"], separation: 0 });
    const chosen = deriveOrderedScheme(LATTE, "dark", { avoid: ["#fb2c36"] });
    expect(forced.crowded).toEqual([]);
    expect(forced.separation).toBeLessThan(SEPARATION_BAR);
    expect(chosen.ordered.length).toBeLessThan(forced.ordered.length);
    expect(chosen.separation).toBeGreaterThanOrEqual(SEPARATION_BAR);
    expect(chosen.separation).toBeGreaterThan(forced.separation);
  });

  it("tells a colour with no hue apart from one the scheme had no room for", () => {
    // Two different facts, and a panel that merges them says something false. Latte's teal is
    // below the chroma floor — there was never anything to use. Its second red and its rose have
    // perfectly good hues; the scheme simply already spends that arc, and removing some *other*
    // colour would let them back in. Only the second is the user's to act on.
    const { kept, crowded, dropped } = deriveOrderedScheme(LATTE, "dark", { avoid: ["#fb2c36"] });
    expect(dropped).toEqual(["#179299"]);
    expect(crowded.length).toBeGreaterThan(0);
    for (const hex of crowded) {
      expect(dropped).not.toContain(hex);
      expect(familyOf(hex)).not.toBeNull();
    }
    expect(kept.length + crowded.length + dropped.length).toBe(LATTE.length);
  });

  it("names the families that made the scheme, not the ones the source happened to carry", () => {
    // `families` is what the source yielded and `kept` is what survived selection. Reading the
    // first as the second is how a panel ends up listing a category the scheme cannot draw.
    const { kept, colours, families } = deriveOrderedScheme(LATTE, "dark", { avoid: ["#fb2c36"] });
    expect(kept).toHaveLength(colours.length);
    expect(kept.length).toBeLessThan(families.length);
    for (const family of kept) expect(families).toContain(family);
  });

  it("settles for the widest legal scheme when no subset can clear the bar", () => {
    // The bar is a preference, like `avoid`, and a preference that refuses is a bug — that lesson
    // was already paid for once. With an unreachable bar the answer is still a scheme, and
    // `separation` says plainly how far short it fell.
    const { ordered, separation } = deriveOrderedScheme(DRACULA_WHEEL, "dark", {
      avoid: ["#fb2c36"],
      separation: 999,
    });
    expect(ordered.length).toBeGreaterThanOrEqual(2);
    expect(separation).toBeLessThan(999);
    expect(separation).toBeGreaterThanOrEqual(CVD_TARGET);
    expect(checkScheme(ordered, { mode: "dark" }).ok).toBe(true);
  });

  it("reports the separation it actually reached, not the one it was asked for", () => {
    const { ordered, separation } = deriveOrderedScheme(LATTE, "light", { avoid: ["#fb2c36"] });
    expect(separation).toBeCloseTo(checkScheme(ordered, { mode: "light" }).cvd.delta, 6);
  });

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

describe("deriveSchemeColors", () => {
  const SLOTS = [
    "base08", "base09", "base0A", "base0B", "base0C", "base0D", "base0E", "base0F",
  ] as const;
  /** A palette's eight accents, which is the only part a categorical scheme may take. */
  const accents = (name: string) =>
    SLOTS.map((slot) => (BASE16_SLOTS[name] as { slots: Record<string, string> }).slots[slot] as string);
  const AVOID = { avoid: ["#fb2c36"], leading: 4 };

  /**
   * Reconcile two independent per-mode derivations: keep only the families both modes kept, then
   * re-derive. This is the obvious cheap alternative to a joint search, and the thing to beat.
   */
  const reconcile = (source: string[]) => {
    const light = deriveOrderedScheme(source, "light", AVOID);
    const dark = deriveOrderedScheme(source, "dark", AVOID);
    const out = new Set([...light.crowded, ...dark.crowded, ...light.dropped]);
    const trimmed = source.filter((hex) => !out.has(hex));
    return {
      light: deriveOrderedScheme(trimmed, "light", AVOID),
      dark: deriveOrderedScheme(trimmed, "dark", AVOID),
    };
  };

  it("hands both modes the same categories", () => {
    // The reason this function exists at all. `SchemeColors` is one set of series shown on two
    // surfaces, so slot 3 must mean the same category in both — and running the per-mode search
    // twice does not give that: kanzo takes 7 families in light and 5 in dark, Catppuccin Latte 7
    // and 5, kanzo-dark 7 and 8. Two arrays of different lengths cannot be one scheme, and two of
    // the same length built from different subsets is worse, because it looks like one.
    for (const name of ["kanzo", "dracula", "catppuccin-mocha"]) {
      const { light, dark, kept } = deriveSchemeColors(accents(name), AVOID);
      expect(light).toHaveLength(kept.length);
      expect(dark).toHaveLength(kept.length);
    }
  });

  it("keeps a category that intersect-then-re-derive throws away", () => {
    // Measured on the palette that shows it: reconciling afterwards lands Dracula on 3 categories,
    // searching jointly finds 4. The subsets each mode prefers alone are different subsets, and the
    // best shared one is neither — so it is not recoverable from two answers that never saw it.
    const source = accents("dracula");
    const after = reconcile(source);
    const joint = deriveSchemeColors(source, AVOID);
    expect(after.light.ordered.length).toBe(3);
    expect(joint.light).toHaveLength(4);
    expect(joint.dark).toHaveLength(4);
    expect(checkScheme(joint.light, { mode: "light" }).ok).toBe(true);
    expect(checkScheme(joint.dark, { mode: "dark" }).ok).toBe(true);
  });

  it("keeps the separation that intersect-then-re-derive spends", () => {
    // The other half of the same loss, on kanzo, where the category count happens to agree: the
    // reconciled light scheme reaches 28.1 against the joint search's 32.5 on the same five slots.
    // A test that only counted categories would call that a tie.
    const source = accents("kanzo");
    const after = reconcile(source);
    const joint = deriveSchemeColors(source, AVOID);
    expect(joint.light).toHaveLength(after.light.ordered.length);
    expect(joint.separation.light).toBeGreaterThan(after.light.separation);
  });

  it("keeps a required family the subset rule would otherwise have spent", () => {
    // The defect this option exists for. The subset rule spends whichever family buys the least
    // separation — a rule that is not wrong, it just has no opinion about whose palette it is.
    // Shipped, that dropped a teal brand's own teal from its charts; `derive-palette.test.ts` holds
    // that instance, which needs all four status fills reserved to reproduce. Dracula shows the same
    // mechanism for the price of a 6-family search: it names 4 categories and spends yellow.
    const free = deriveSchemeColors(DRACULA, AVOID);
    const held = deriveSchemeColors(DRACULA, { ...AVOID, require: ["yellow"] });
    expect(free.kept).not.toContain("yellow");
    expect(held.kept).toContain("yellow");
    // It bought that back for nothing: same number of categories, still passing both gates.
    expect(held.light).toHaveLength(free.light.length);
    expect(checkScheme(held.light, { mode: "light" }).ok).toBe(true);
    expect(checkScheme(held.dark, { mode: "dark" }).ok).toBe(true);
    // Membership only, in both directions. Held in, yellow does not lead — and lime, held in on the
    // same source, does. The sequence stays the search's answer either way.
    expect(familyOf(held.light[0] as string)).not.toBe("yellow");
    expect(familyOf(deriveSchemeColors(DRACULA, { ...AVOID, require: ["lime"] }).light[0] as string))
      .toBe("lime");
    // And the accounting still adds up — a family held in is not a family "crowded" out.
    expect(held.kept.length + held.crowded.length + held.dropped.length).toBe(DRACULA.length);
  });

  it("ignores a required family the source never yielded", () => {
    // A family that never arrived cannot be kept, and there is no subset for which this is a
    // different answer — so it constrains nothing rather than refusing the derivation.
    const source = accents("dracula");
    const held = deriveSchemeColors(source, { ...AVOID, require: ["teal"] });
    expect(held.light).toEqual(deriveSchemeColors(source, AVOID).light);
  });

  it("reports each mode's separation, never their minimum", () => {
    // A scheme is routinely comfortable on one surface and marginal on the other — Catppuccin Mocha
    // measures 19.7 in light and 25.6 in dark. Collapsing that to `min` would make a panel warn
    // about the mode that is fine and stay silent about neither, and the two numbers are not
    // recoverable from the one.
    const { light, dark, separation } = deriveSchemeColors(accents("catppuccin-mocha"), AVOID);
    expect(separation.light).toBeCloseTo(checkScheme(light, { mode: "light" }).cvd.delta, 6);
    expect(separation.dark).toBeCloseTo(checkScheme(dark, { mode: "dark" }).cvd.delta, 6);
    expect(separation.light).not.toBeCloseTo(separation.dark, 1);
  });

  it("still cannot rescue Nord, in either mode", () => {
    // Searching two modes at once must not have found a way to pass by accident. Seven of Nord's
    // eight accents are below the chroma floor; one colour is not a categorical palette, and the
    // refusal has to survive every change to how the subsets are chosen.
    const { light, dark, dropped, separation } = deriveSchemeColors(accents("nord"), AVOID);
    expect(dropped.length).toBeGreaterThanOrEqual(7);
    expect(light).toEqual([]);
    expect(dark).toEqual([]);
    expect(separation).toEqual({ light: 0, dark: 0 });
  });

  it("accounts for every source colour exactly once, refusals included", () => {
    // `kept`, `crowded` and `dropped` are what a panel adds up to explain itself. If they do not
    // sum to the source, some colour vanished without a reason attached — and the refusal case is
    // where that is easiest to get wrong, because there is no subset to attribute anything to.
    for (const name of Object.keys(BASE16_SLOTS)) {
      const source = accents(name);
      const { kept, crowded, dropped } = deriveSchemeColors(source, AVOID);
      expect(kept.length + crowded.length + dropped.length).toBe(source.length);
      // Two different facts, never merged: no usable hue at all, versus a hue the scheme had no
      // room left for. Only the second changes if the user removes some other colour.
      for (const hex of crowded) expect(dropped).not.toContain(hex);
    }
  });
});

describe("the search's pair index agrees with the gate it stands in for", () => {
  it("gives allPairsCap the answer checkScheme would", () => {
    // The searches score through a memoised index of `checkScheme`'s own arithmetic — it is what
    // makes a two-mode search affordable — and an index that drifts from the gate is the worst
    // failure available here: every scheme would still be *reported* against the real gate while
    // being *chosen* against a stale one, so nothing would fail, the answers would just quietly get
    // worse. `allPairsCap` is the public surface that runs entirely through the index.
    const spec = (colours: readonly string[], mode: "light" | "dark") => {
      let n = 2;
      while (n <= colours.length && checkScheme(colours.slice(0, n), { mode, pairs: "all" }).ok) n += 1;
      return n - 1;
    };
    for (const mode of ["light", "dark"] as const) {
      const shipped = (SCHEMES.kanzo as { light: string[]; dark: string[] })[mode];
      expect(allPairsCap(shipped, mode)).toBe(spec(shipped, mode));
      // Including the degenerate ends, where a vacuous pass is exactly what the index could invent.
      expect(allPairsCap(shipped.slice(0, 1), mode)).toBe(spec(shipped.slice(0, 1), mode));
      expect(allPairsCap([], mode)).toBe(spec([], mode));
      // And a scheme that fails: two greys are out of band and below the chroma floor at once.
      expect(allPairsCap(["#737373", "#8a8a8a"], mode)).toBe(spec(["#737373", "#8a8a8a"], mode));
    }
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
    // Not the full source length any more — selection may keep fewer families than the palette
    // offers — but still a scheme, which is the only thing `avoid` was ever allowed to cost.
    expect(ordered.length).toBeGreaterThanOrEqual(2);
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
