import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { oklch, CHROMA_FLOOR } from "@kanzo-tech/palette";
import { describe, expect, it } from "vitest";

/**
 * No hue is written by hand.
 *
 * The rule is about *chroma*, not about literals in general, and that distinction is the whole
 * point. An achromatic literal belongs to nobody's palette — a shadow at 8% black, the two
 * extremes a readable-foreground calculation picks between, a scrim. A **chromatic** one is a
 * palette decision made somewhere that cannot be validated, cannot follow the theme, and cannot be
 * changed by choosing a different one.
 *
 * This is not hypothetical. Three categorical palettes existed in parallel here and two of them
 * failed the colour checks; the Preferences swatches drifted a whole Tailwind major away from the
 * accents they stood for. Both were hand-written hues, and nothing could tell.
 */

const SRC = dirname(fileURLToPath(import.meta.url));

/** Files whose subject matter *is* colour, where literals are the content rather than a decision. */
const ALLOWED = new Set(["simples/color-picker.tsx"]);

const HEX = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
const RGB = /\brgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/g;
const OKLCH = /\boklch\(\s*[\d.]+%?\s+([\d.]+)/g;

/** Comments are prose: they quote the very hexes this rule is about, and quoting is not deciding. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) yield path;
  }
}

const expand = (hex: string) =>
  hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join("")}` : hex;
const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((n) => Math.min(255, n).toString(16).padStart(2, "0")).join("")}`;

describe("no literal hues in the source", () => {
  it("leaves every chromatic colour to the theme", () => {
    const offenders: string[] = [];

    for (const file of walk(SRC)) {
      const rel = file.slice(SRC.length).replace(/^\/+/, "");
      if (ALLOWED.has(rel)) continue;
      const source = stripComments(readFileSync(file, "utf8"));

      const found: string[] = [];
      for (const [match, hex] of source.matchAll(HEX)) {
        if (oklch(expand(`#${hex}`)).c >= CHROMA_FLOOR) found.push(match);
      }
      for (const [match, r, g, b] of source.matchAll(RGB)) {
        if (oklch(toHex(Number(r), Number(g), Number(b))).c >= CHROMA_FLOOR) found.push(match);
      }
      for (const [match, chroma] of source.matchAll(OKLCH)) {
        if (Number(chroma) >= CHROMA_FLOOR) found.push(match);
      }

      if (found.length) offenders.push(`${rel}: ${found.join(", ")}`);
    }

    expect(
      offenders,
      `A hue written by hand cannot be validated, cannot follow the theme, and cannot be changed by\n` +
        `picking another palette. Use a token, or a scheme slot:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("would catch a hue if one appeared", () => {
    // The rule is only worth having if it bites — and it has to bite on chroma, not on the mere
    // presence of a literal, or every shadow in the codebase becomes a violation.
    expect(oklch("#2563eb").c).toBeGreaterThanOrEqual(CHROMA_FLOOR);
    expect(oklch("#000000").c).toBeLessThan(CHROMA_FLOOR);
    expect(oklch("#ffffff").c).toBeLessThan(CHROMA_FLOOR);
  });
});
