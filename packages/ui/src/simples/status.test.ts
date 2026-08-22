import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
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

/**
 * The corpus is every SHIPPED THEME, not two blocks of one document.
 *
 * It used to read `tokens.css` and split it into a `:root` half and a `.dark` half, because colour
 * lived there as one compiled document carrying both modes. A theme is now one mode and one flat
 * file, so "light" and "dark" stopped being halves of anything and became a property each theme
 * declares — `color-scheme` — and the measurement went from ten pairs to five variants across
 * however many themes ship.
 *
 * **That is the check `.planning/THEME-REFOUNDATION.md` section 8 promised to bring back, and it
 * turned out to already be here.** Cutting the derivation gave up a contrast measurement made at
 * DERIVATION time; this measures the artefact instead, which needs no ramps and no palette package
 * — a contrast function and the files we ship. It is the difference between "the author answers for
 * AA" and "the author answers for AA and finds out when they are wrong".
 */
const THEME_DIR = join(
  dirname(createRequire(import.meta.url).resolve("@kanzo-tech/theme/themes.css")),
  "themes",
);

const THEMES = readdirSync(THEME_DIR)
  .filter((f) => f.endsWith(".css"))
  .map((f) => {
    const css = readFileSync(join(THEME_DIR, f), "utf8");
    return { name: f.slice(0, -4), css, dark: /color-scheme:\s*dark\b/.test(css) };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

/**
 * `--token: #hex` in one theme.
 *
 * Anchored at the start of the declaration: an unanchored `--foreground` also matches
 * `--card-foreground` and `--muted-foreground`, and would silently measure the wrong colour.
 *
 * A theme may leave a token to its derived default, in which case there is nothing here to measure
 * and the caller skips — an absence is not a failure, it is the theme saying "use the one above".
 */
function value(theme: { name: string; css: string }, token: string): string | null {
  const hit = new RegExp(`^\\s*${token}:\\s*(#[0-9a-f]{6})`, "im").exec(theme.css);
  return hit ? (hit[1] as string).toLowerCase() : null;
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

/** The fill and ink a variant resolves to, read out of the emitted class list, in one theme. */
function pair(
  variant: "default" | "success" | "info" | "warning" | "destructive",
  theme: { name: string; css: string; dark: boolean },
) {
  const classes = statusVariants({ variant }).split(/\s+/);
  const pick = (prefix: string) => {
    // Token-backed utilities only: the base also carries `text-[10px]`, an arbitrary value that
    // names no colour. A `dark:` prefix still wins on a dark theme — the class has stopped flipping
    // tokens but is still how a recipe spells "on the dark side".
    const named = (c: string) => new RegExp(`^${prefix}[a-z][a-z-]*$`).test(c);
    const scoped = classes.find((c) => c.startsWith("dark:") && named(c.slice("dark:".length)));
    const plain = classes.find(named);
    const chosen = theme.dark && scoped ? scoped.slice("dark:".length) : plain;
    if (!chosen) throw new Error(`${variant}: no token-backed ${prefix} utility`);
    return `--${chosen.slice(prefix.length)}`;
  };
  const fillToken = pick("bg-");
  const inkToken = pick("text-");
  return { fillToken, inkToken, fill: value(theme, fillToken), ink: value(theme, inkToken) };
}

const VARIANTS = ["default", "success", "info", "warning", "destructive"] as const;

describe("a status dot's ink is measured against its own fill", () => {
  it("has a corpus, and it is every shipped theme", () => {
    // A guard whose corpus is empty is indistinguishable from a guard that passes. This is the
    // sentence that would have caught the migration quietly emptying it.
    expect(THEMES.length).toBeGreaterThan(1);
    expect(THEMES.some((t) => t.dark)).toBe(true);
    expect(THEMES.some((t) => !t.dark)).toBe(true);
  });

  it.each(VARIANTS)("%s carries AA in every theme that declares it", (variant) => {
    const measured: string[] = [];
    for (const theme of THEMES) {
      const { fill, ink, fillToken, inkToken } = pair(variant, theme);
      if (!fill || !ink) continue; // the theme defers this token; nothing of its own to measure
      const ratio = contrast(ink, fill);
      measured.push(theme.name);
      expect(
        ratio,
        `${theme.name} / ${variant}: ${inkToken} ${ink} on ${fillToken} ${fill} = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
    expect(measured.length, `${variant} was measured against no theme at all`).toBeGreaterThan(0);
  });

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
