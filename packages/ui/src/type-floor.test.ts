import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogue } from "../../theme/scripts/catalogue.mjs";
import { label, sourceFiles, unreadable } from "./guard-corpus";

/**
 * Nothing in the corpus sets type below 11px at the default root.
 *
 * WCAG sets no minimum type size, so this is a house bar, and the number has a reason: 11px is
 * `--kanzo-font-size-small`, two steps under the IDE tier's 13px base, and the design pass of
 * 2026-11-04 found three things under it — `Badge size="xs"` and `Status`'s words at a 10px
 * arbitrary value, and `--kanzo-font-size-xs`, a 10px step with no reader but the badge. Those were
 * fixed and deleted. The graph's node labels and its count chip were `text-[10px]` as well, and the
 * pass did not see them; this guard reported both on its first run, and they read the token now.
 *
 * **The floor is at the default root, by design.** Every size is a `rem`, and density moves the
 * root: at compact the smallest step is 9.63px. That is the density axis doing what it is for, and
 * `packages/theme/src/obligations.ts` keeps the compact figure as an ungraded row (`x-height`) whose
 * closing condition was this guard. What this reads is the size a recipe *writes*.
 *
 * ## What it rejects
 *
 * - An arbitrary size under the floor: `text-[Npx]`, `text-[Nrem]`, `text-[Nem]`, the same with a
 *   `length:` hint, and an arbitrary `[font-size:…]` property.
 * - A `fontSize` in a style object or a CodeMirror theme, as a string with a unit or a bare number
 *   (React reads a number as pixels).
 * - A named step smaller than Tailwind's own scale: `text-2xs`, `text-3xs`, `text-xxs`, `text-tiny`.
 *   Tailwind ships none of them, so one only resolves if a theme declares it — which the next item
 *   would also catch.
 * - A read of `--kanzo-font-size-*` whose value in `tokens.css` is under the floor, and any type
 *   step `tokens.css` declares under it. Whether the name exists at all is `theme-tokens.test.ts`'s
 *   question; this asks only how big it is.
 *
 * ## What it cannot prove
 *
 * - **An `em` is graded as if its parent were the root.** `text-[0.7em]` in a density specimen is
 *   0.7 of whatever it sits in, and only a browser knows that. A value of 0.6875em or more passes;
 *   one inside a parent already at the floor would compute under it, and nothing here sees that.
 * - **It reads literal spellings.** A size built from fragments, a `calc()`, a `clamp()`, a
 *   `text-(length:--x)` naming a property set at runtime, or anything a consumer passes through
 *   `className` is invisible.
 * - **It reads the corpus — `ui`, `ai`, `graph` — and not `docs/`.** A showcase hand-rolls on
 *   purpose; `docs/showcases/field-notes/default.tsx` sets a 0.625rem slip in tracked capitals, a
 *   hand press's look in a showcase about one, and it is out of reach here by the same decision that
 *   keeps it out of every idiom rule.
 * - **It does not measure x-height.** 11px in a face with a small x-height reads smaller than 11px
 *   in one with a large one; the floor is on the declared size, which is what a recipe controls.
 */

const FLOOR_PX = 11;
const ROOT_PX = 16;

const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const toPx = (value: number, unit = "px") => (unit === "px" ? value : value * ROOT_PX);

/** `--kanzo-font-size-small` → its value in px at the default root, or `undefined` if it is not a length. */
function tokenPx(name: string): number | undefined {
  const value = catalogue.root.get(name);
  const m = value === undefined ? null : /^(\d*\.?\d+)(px|rem)$/.exec(value.trim());
  return m ? toPx(Number(m[1]), m[2]) : undefined;
}

const NUMBER = String.raw`(\d*\.?\d+)`;
const ARBITRARY = new RegExp(String.raw`(?<![\w-])text-\[(?:length:)?${NUMBER}(px|rem|em)\]`, "g");
const PROPERTY = new RegExp(String.raw`\[font-size:${NUMBER}(px|rem|em)\]`, "g");
const STYLE = new RegExp(String.raw`\bfontSize:\s*(?:["'\`]${NUMBER}(px|rem|em)["'\`]|${NUMBER}(?![\w.]))`, "g");
const NAMED = /(?<![\w-])text-(?:\d+xs|xxs|tiny|micro|mini)(?![\w-])/g;
const TOKEN = /var\(\s*(--kanzo-font-size-[\w-]+)/g;

/** Every size in `source` under the floor, as `spelling = Npx`, and how many sizes it graded. */
function belowFloor(source: string): { read: number; under: string[] } {
  let read = 0;
  const under: string[] = [];
  const grade = (spelling: string, px: number | undefined) => {
    read++;
    if (px === undefined || px < FLOOR_PX) under.push(`${spelling} = ${px === undefined ? "?" : `${+px.toFixed(2)}px`}`);
  };
  for (const pattern of [ARBITRARY, PROPERTY]) {
    for (const m of source.matchAll(pattern)) grade(m[0], toPx(Number(m[1]), m[2]));
  }
  for (const m of source.matchAll(STYLE)) {
    grade(m[0], m[1] === undefined ? Number(m[3]) : toPx(Number(m[1]), m[2]));
  }
  for (const m of source.matchAll(NAMED)) {
    read++;
    under.push(`${m[0]} = a step under Tailwind's scale`);
  }
  for (const m of source.matchAll(TOKEN)) grade(m[0], tokenPx(m[1] as string));
  return { read, under };
}

const FILES = sourceFiles(/\.(?:tsx?|css)$/);

let sizesRead = 0;
const findings: string[] = [];
for (const file of FILES) {
  const { read, under } = belowFloor(stripComments(readFileSync(file, "utf8")));
  sizesRead += read;
  for (const hit of under) findings.push(`${label(file)} · ${hit}`);
}

describe("type floor", () => {
  it("reads a corpus, and the token the floor is named after", () => {
    // A scan over nothing passes every assertion under it.
    expect(FILES.length).toBeGreaterThan(100);
    expect(sizesRead, "the scan found almost no font size — it is not reading the recipes").toBeGreaterThanOrEqual(6);
    expect(unreadable(FILES).binary).toEqual([]);
    expect(tokenPx("--kanzo-font-size-small")).toBe(FLOOR_PX);
  });

  it("no type step the theme declares is under 11px", () => {
    const steps = [...catalogue.root.keys()].filter(
      (name) => name.startsWith("--kanzo-font-size-") || (/^--text-[\w-]+$/.test(name) && !name.includes("--", 2)),
    );
    expect(steps.length).toBeGreaterThanOrEqual(2);
    const under = steps.filter((name) => (tokenPx(name) ?? 0) < FLOOR_PX);
    expect(under, "the scale emits a step under the house floor").toEqual([]);
  });

  it("no recipe or class in the corpus sets type below 11px", () => {
    expect(findings.sort(), "type under the 11px floor — read `--kanzo-font-size-small`").toEqual([]);
  });

  it("would catch a size under the floor however it was spelled", () => {
    // Assembled from parts so that no whole class name exists in this file's bytes for Tailwind's
    // scan to compile.
    const t = (inner: string) => ["text", `[${inner}]`].join("-");
    for (const spelling of [
      t("10px"),
      t("10.5px"),
      `md:${t("9px")}`,
      t("0.625rem"),
      t("0.6em"),
      t("length:10px"),
      "[font-size:10px]",
      'fontSize: "10px"',
      "fontSize: 9",
      ["text", "2xs"].join("-"),
      ["text", "3xs"].join("-"),
      "var(--kanzo-font-size-xs)",
    ]) {
      expect(belowFloor(spelling).under, `${spelling} was not caught`).toHaveLength(1);
    }
    for (const spelling of [
      t("11px"),
      t("0.6875rem"),
      t("0.7em"),
      t("length:var(--kanzo-font-size-small)"),
      "text-xs",
      "text-[var(--btn-fg)]",
      'fontSize: "var(--kanzo-font-size-base)"',
      'fontSize: "medium"',
    ]) {
      expect(belowFloor(spelling).under, `${spelling} is at or over the floor`).toEqual([]);
    }
  });
});
