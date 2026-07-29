import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { statusVariants } from "./status.js";

/**
 * A status dot may hold a glyph, so its ink is measured against its own fill — in both modes.
 *
 * This file exists because there was no test here and a defect used the gap. The destructive
 * variant carried `dark:bg-destructive-foreground`, which moved the FILL and left the INK: a glyph
 * measured **2.35:1** in dark, against a 4.58 worst case across the other nine pairs. That is the
 * `text-white` defect
 * the `--*-content` tokens were created to kill, reappearing through a `dark:` override — the ink
 * token was still the right one for the fill it had been measured against, and the override changed
 * the fill underneath it.
 *
 * So the recipe is read rather than trusted: whatever `statusVariants` emits is parsed back into a
 * (fill, ink) pair per mode and measured against the shipped `tokens.css`. A future `dark:bg-…`
 * override fails here instead of shipping.
 */

const tokens = readFileSync(
  createRequire(import.meta.url).resolve("@kanzo-tech/theme/tokens.css"),
  "utf8",
);

/**
 * `--token: #hex` from the `:root` block (light) or the `.dark` block, in source order.
 *
 * Anchored at the start of the declaration: an unanchored `--foreground` also matches
 * `--card-foreground` and `--muted-foreground`, and would silently measure the wrong colour.
 */
function value(token: string, mode: "light" | "dark"): string {
  const all = [...tokens.matchAll(new RegExp(`^\\s*${token}:\\s*(#[0-9a-f]{6})`, "gim"))];
  const hit = mode === "light" ? all[0] : all[all.length - 1];
  if (!hit) throw new Error(`${token} not declared in tokens.css`);
  return (hit[1] as string).toLowerCase();
}

function luminance(hex: string): number {
  const channels = [0, 2, 4]
    .map((i) => Number.parseInt(hex.slice(1 + i, 3 + i), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (channels[0] as number) + 0.7152 * (channels[1] as number) + 0.0722 * (channels[2] as number);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The fill and ink a variant resolves to in one mode, read out of the emitted class list. */
function pair(variant: "default" | "success" | "info" | "warning" | "destructive", mode: "light" | "dark") {
  const classes = statusVariants({ variant }).split(/\s+/);
  const pick = (prefix: string) => {
    // Token-backed utilities only: the base also carries `text-[10px]`, an arbitrary value that
    // names no colour. A `dark:` prefix wins in dark and is absent in light.
    const named = (c: string) => new RegExp(`^${prefix}[a-z][a-z-]*$`).test(c);
    const scoped = classes.find((c) => c.startsWith("dark:") && named(c.slice("dark:".length)));
    const plain = classes.find(named);
    const chosen = mode === "dark" && scoped ? scoped.slice("dark:".length) : plain;
    if (!chosen) throw new Error(`${variant}: no token-backed ${prefix} utility`);
    return `--${chosen.slice(prefix.length)}`;
  };
  const fillToken = pick("bg-");
  const inkToken = pick("text-");
  return { fillToken, inkToken, fill: value(fillToken, mode), ink: value(inkToken, mode) };
}

const VARIANTS = ["default", "success", "info", "warning", "destructive"] as const;

describe("a status dot's ink is measured against its own fill", () => {
  it.each(VARIANTS.flatMap((v) => (["light", "dark"] as const).map((m) => [v, m] as const)))(
    "%s carries AA in %s",
    (variant, mode) => {
      const { fill, ink, fillToken, inkToken } = pair(variant, mode);
      const ratio = contrast(ink, fill);
      expect(ratio, `${variant} ${mode}: ${inkToken} ${ink} on ${fillToken} ${fill}`).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("uses one rule for all five, with no per-variant mode override", () => {
    // The override that broke destructive was legal-looking and invisible in review. A variant that
    // repaints its fill in one mode only is the shape to catch, not the specific token that did it.
    for (const variant of VARIANTS) {
      const classes = statusVariants({ variant }).split(/\s+/);
      const overrides = classes.filter((c) => /^dark:(bg|text)-/.test(c));
      expect(overrides, `${variant} overrides its colour in dark only`).toEqual([]);
    }
  });
});
