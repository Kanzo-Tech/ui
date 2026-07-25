import { describe, expect, it } from "vitest";
import { resolveTokenColor } from "./theme.js";

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
