import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import {
  CHART_CAPACITY_PROPERTY,
  CHART_SLOTS,
  categoricalCapacity,
  categoricalColor,
  resolveTokenColor,
} from "./token-color.js";

// jsdom's getComputedStyle returns the `color-mix(...)` back unchanged, so the probe path itself
// is not testable here. What matters — and what broke in a real browser — is the normalisation of
// the `color(srgb …)` serialisation, exercised through a stubbed host.
function host(computed: string): Element {
  return {
    appendChild(node: { style: Record<string, string>; remove: () => void }) {
      Object.defineProperty(node, "__computed", { value: computed });
    },
  } as unknown as Element;
}

describe("resolveTokenColor", () => {
  const withComputedColor = (computed: string) => {
    const original = globalThis.getComputedStyle;
    globalThis.getComputedStyle = (() => ({ color: computed })) as unknown as typeof globalThis.getComputedStyle;
    try {
      return resolveTokenColor(host(computed) as Element, "--chart-1");
    } finally {
      globalThis.getComputedStyle = original;
    }
  };

  it("passes rgb() through untouched", () => {
    expect(withComputedColor("rgb(37, 99, 235)")).toBe("rgb(37, 99, 235)");
  });

  it("normalises color(srgb …) to rgb()", () => {
    expect(withComputedColor("color(srgb 0.61 0.61 0.61)")).toBe("rgb(156, 156, 156)");
  });

  it("handles out-of-gamut components instead of leaking the raw string", () => {
    // Chrome serialises a wide-gamut token this way. Leaking it made Plot read the colour as a
    // column name and fail the query with a binder error.
    expect(withComputedColor("color(srgb 0.96 0.28 -0.15)")).toBe("rgb(245, 71, 0)");
    expect(withComputedColor("color(srgb 1.02 0.3 0.1)")).toBe("rgb(255, 77, 26)");
  });

  it("keeps alpha when present", () => {
    expect(withComputedColor("color(srgb 0 0 0 / 0.5)")).toBe("rgba(0, 0, 0, 0.5)");
  });
});

/**
 * The scheme is defined once and projected twice — into this package's compiled export and into
 * `--chart-*` in the theme's CSS. Nothing in the type system stops the two drifting, and drift is
 * exactly the failure this whole change exists to end: the library used to carry eight hardcoded
 * hues that disagreed with the tokens, so the same series was one colour through `ChartConfig` and
 * another through a token. These tests are the thing that keeps that from coming back.
 */
describe("the categorical scheme", () => {
  /**
   * Every shipped theme that declares a categorical set, and the slots it declares.
   *
   * It used to read `tokens.css` and slice one list into a light half and a dark half. A theme is
   * now one mode and one file, so there is no list to slice: there are themes, each of which either
   * publishes a set or DECLINES the channel. Declining is legal and is what
   * `decisions/monochrome-is-a-palette-not-a-look.md` requires a monochrome document to be able to
   * say — so a theme with no slots is skipped, and a theme with SOME slots is the bug this catches.
   */
  const THEME_DIR = join(
    dirname(createRequire(import.meta.url).resolve("@kanzo-tech/theme/themes.css")),
    "themes",
  );
  const themes = readdirSync(THEME_DIR)
    .filter((f) => f.endsWith(".css"))
    .map((f) => ({
      name: f.slice(0, -4),
      // Any VALUE, not just a hex. A theme publishes all eight slots and says how many name a real
      // category with `--chart-capacity`; past capacity `compile()` wrote `var(--muted-foreground)`,
      // and the first version of this read hexes only, so `bank-private-dark` (capacity 7) looked
      // like a theme with a partial set. Slot COUNT and capacity are different questions.
      slots: [...readFileSync(join(THEME_DIR, f), "utf8").matchAll(/--chart-(\d+):\s*([^;]+);/g)]
        .map(([, , value]) => (value as string).trim()),
    }));

  it("declares a full set of slots, or none at all, in every theme", () => {
    // The literal-vs-token drift this file was written to catch is now structurally impossible: the
    // library exports no scheme values at all. What is left to own is the contract between a
    // theme's slot COUNT and `categoricalColor`'s fold — an off-by-one there hands series 9 the
    // colour of series 1 silently.
    expect(themes.length, "no themes found at all").toBeGreaterThan(1);
    const partial = themes.filter((t) => t.slots.length > 0 && t.slots.length !== CHART_SLOTS);
    expect(partial.map((t) => `${t.name}: ${t.slots.length}`), "a theme declares a partial set").toEqual([]);
    expect(themes.some((t) => t.slots.length === CHART_SLOTS), "no theme publishes a set").toBe(true);
    expect(CHART_SLOTS).toBe(8);
  });

  it("hands out a slot token per series and folds past the last slot", () => {
    expect(categoricalColor(0)).toBe("var(--chart-1)");
    expect(categoricalColor(CHART_SLOTS - 1)).toBe(`var(--chart-${CHART_SLOTS})`);
    // Never cycle: a ninth series wearing slot 1 would claim to be the first one.
    expect(categoricalColor(CHART_SLOTS)).toBe("var(--muted-foreground)");
    expect(categoricalColor(-1)).toBe("var(--muted-foreground)");
  });

  /**
   * A set's `capacity` is how many slots name a REAL category, and it is not always `CHART_SLOTS`:
   * over 24 brand hues one every 15° it came back 6–8, mean 7.50, with 11 of 24 under 8. `compile()`
   * already writes `var(--muted-foreground)` past capacity so the colour is right either way — what
   * this fold owns is the COUNT, which is what a legend and any "group the tail" pass read.
   */
  it("folds at capacity when the caller knows one", () => {
    expect(categoricalColor(5, undefined, 6)).toBe("var(--chart-6)");
    expect(categoricalColor(6, undefined, 6)).toBe("var(--muted-foreground)");
    // Capacity can never widen the vocabulary — there is no `--chart-9` to hand out.
    expect(categoricalColor(CHART_SLOTS, undefined, 12)).toBe("var(--muted-foreground)");
  });
});

describe("categoricalCapacity", () => {
  const withProperty = (value: string | null) => {
    const original = globalThis.getComputedStyle;
    globalThis.getComputedStyle = (() => ({
      getPropertyValue: (name: string) => (name === CHART_CAPACITY_PROPERTY ? (value ?? "") : ""),
    })) as unknown as typeof globalThis.getComputedStyle;
    try {
      return categoricalCapacity({} as Element);
    } finally {
      globalThis.getComputedStyle = original;
    }
  };

  it("reads the declared capacity", () => {
    expect(withProperty(" 6 ")).toBe(6);
  });

  it("falls back to the slot count when the document declares nothing", () => {
    // The honest default: a stylesheet without the property is one older than the document schema.
    expect(withProperty(null)).toBe(CHART_SLOTS);
    expect(withProperty("not-a-number")).toBe(CHART_SLOTS);
    expect(withProperty("  ")).toBe(CHART_SLOTS);
  });

  it("honours a declared zero, because a document may decline the channel", () => {
    // This used to fold up to the full slot count with everything else that was not a positive
    // number, and while zero could only arrive by accident that was right. A monochrome document
    // publishes `--chart-capacity: 0` deliberately — it spends no colour on categories, so every
    // slot resolves to the muted role — and folding it up would paint eight distinguishable
    // colours on the one document that published none.
    //
    // The cascade is what tells a decision from an omission: an undeclared property comes back as
    // an empty string, never as "0". See `decisions/monochrome-is-a-palette-not-a-look.md`.
    expect(withProperty("0")).toBe(0);
    expect(categoricalColor(0, undefined, withProperty("0"))).toBe("var(--muted-foreground)");
    // Still not a licence for nonsense: a negative is damage, not a declaration.
    expect(withProperty("-1")).toBe(CHART_SLOTS);
  });

  it("never claims more slots than the vocabulary has", () => {
    expect(withProperty("12")).toBe(CHART_SLOTS);
  });
});
