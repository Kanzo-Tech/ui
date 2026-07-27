import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { CHART_SCHEME, CHART_SLOTS, categoricalColor, resolveTokenColor } from "./theme.js";

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

  it("ships the same slots as literals and as CSS tokens", () => {
    expect(declared("light")).toEqual(CHART_SCHEME.light);
    expect(declared("dark")).toEqual(CHART_SCHEME.dark);
  });

  it("gives both modes the same number of slots", () => {
    expect(CHART_SCHEME.dark).toHaveLength(CHART_SLOTS);
    expect(CHART_SLOTS).toBe(8);
  });

  it("hands out a slot token per series and folds past the last slot", () => {
    expect(categoricalColor(0)).toBe("var(--chart-1)");
    expect(categoricalColor(CHART_SLOTS - 1)).toBe(`var(--chart-${CHART_SLOTS})`);
    // Never cycle: a ninth series wearing slot 1 would claim to be the first one.
    expect(categoricalColor(CHART_SLOTS)).toBe("var(--muted-foreground)");
    expect(categoricalColor(-1)).toBe("var(--muted-foreground)");
  });
});
