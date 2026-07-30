import { readFileSync } from "node:fs";
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
  const tokens = readFileSync(
    createRequire(import.meta.url).resolve("@kanzo-tech/theme/tokens.css"),
    "utf8",
  );
  /** `--chart-N` declarations in source order — light comes first in the file, then `.dark`. */
  const declared = (mode: "light" | "dark") =>
    [...tokens.matchAll(/--chart-(\d+):\s*(#[0-9a-f]{6})/gi)]
      .slice(mode === "light" ? 0 : CHART_SLOTS, mode === "light" ? CHART_SLOTS : undefined)
      .map(([, , hex]) => (hex as string).toLowerCase());

  it("declares a full set of slots in both modes", () => {
    // The literal-vs-token drift this file was written to catch is now structurally impossible:
    // the library exports no scheme values at all, and `packages/theme` asserts `tokens.css` is
    // `compile(kanzo.json)` byte for byte. What is left to own here is the contract between the
    // stylesheet's slot COUNT and `categoricalColor`'s fold — an off-by-one there hands series 9
    // the colour of series 1 silently.
    expect(declared("light")).toHaveLength(CHART_SLOTS);
    expect(declared("dark")).toHaveLength(CHART_SLOTS);
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
    // The honest default: a stylesheet without the property is every stylesheet shipped so far.
    expect(withProperty(null)).toBe(CHART_SLOTS);
    expect(withProperty("not-a-number")).toBe(CHART_SLOTS);
    expect(withProperty("0")).toBe(CHART_SLOTS);
  });

  it("never claims more slots than the vocabulary has", () => {
    expect(withProperty("12")).toBe(CHART_SLOTS);
  });
});
