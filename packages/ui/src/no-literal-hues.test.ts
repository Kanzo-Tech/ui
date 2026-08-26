import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHROMA_FLOOR, label, oklch, sourceFiles, subtrees, unreadable } from "./guard-corpus";

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
 *
 * A second half of the same rule is a *class* rather than a value: "raw palette" is forbidden too,
 * and a slate background is the example. Such a class carries no hex a scanner can
 * measure, but it is still somebody else's palette compiled in at build time, and it moves when
 * Tailwind moves rather than when the tenant document does. That half is banned by *name*, not by
 * chroma, and it covers all twenty-two v4 families including the five greys: `slate` is a blue-grey,
 * and picking it over `zinc` is a palette decision even though both sit under the chroma floor.
 *
 * (No example in this file is spelled out as a whole class, here or in the assertions below.
 * `styles.css` points its `@source` at every `.ts` and `.tsx` under `src/`, tests included — so a
 * literal example would emit a real utility for the very class the rule forbids. Every family and
 * every utility prefix therefore appears only as an alternation fragment, and the assertions join
 * their examples at runtime.)
 *
 * ## What this guard cannot prove
 *
 * - **It reads source, not the rendered page.** A hue arriving through `style={{ color: props.x }}`,
 *   a value fetched at runtime, a class assembled from fragments (`` `bg-${family}-500` ``) or a hex
 *   inside `docs/` is invisible here. `Swatch` and `ColorPicker` exist precisely because a colour
 *   that is *data* cannot be tokenised, and this guard cannot tell that case from a mistake.
 * - **It does not resolve indirection.** `var(--token)`, `color-mix(…)` and relative-colour syntax
 *   (`oklch(from … )`) are not evaluated — a chromatic result reached through any of them passes.
 *   The tokens themselves are guarded on the other side, by `packages/theme/src/palettes.test.ts`.
 * - **It does not police achromatic literals, and two live ones are worth knowing about**:
 *   `simples/slider.tsx` paints its thumb `bg-white` and `simples/color-picker.tsx` uses
 *   `border-white` / `text-white`. `white` and `black` are unnumbered and carry no chroma, so they
 *   are outside this rule by construction. This file handed the question — should a thumb be white
 *   in dark mode? — to the component review, and **the review answered it on 2026-08-03: both
 *   stay**, for two different reasons.
 *
 *   `color-picker`'s three sit on a colour the USER picked — the hue strip, the saturation area, a
 *   swatch — where no token can describe what contrasts, which is why each is paired with
 *   `shadow-[0_0_0_1px_rgba(0,0,0,0.1),inset_0_0_0_1px_rgba(0,0,0,0.1)]`: a white ring with a black
 *   hairline either side reads on anything, and that pairing is the argument rather than the white.
 *
 *   `slider`'s is the reference's, verbatim — Shark's `slider.tsx` Thumb carries the same
 *   `"bg-white"` in the same position among the same token-backed neighbours. So
 *   `decisions/match-the-reference.md` settles it unless a measurement overrules it, and none does:
 *   white on a dark track is high contrast, not low. The dark-mode worry was about the metaphor, a
 *   knob that does not follow the theme, and that is a design choice Shark took and we follow.
 * - **It measures chroma, not contrast.** A tokenised colour can still fail AA. That is
 *   `@kanzo-tech/palette`'s job, and the reason tokenising is worth insisting on: an untokenised
 *   colour is a colour no test can measure.
 * - **`color()` is only understood in the sRGB spaces.** `color(display-p3 …)` and the other
 *   predefined spaces are not parsed; nothing in the repo emits one, and adding a reader for a
 *   space we do not produce would be a claim with no corpus behind it.
 * - **It does not read CSS, and one CSS file per package is standing inside the corpus.** The walk
 *   descends every directory under each package's `src/`, then keeps only `.tsx?` — so
 *   `packages/ui/src/styles.css` and `packages/ai/src/styles.css` are passed over in silence, by a
 *   filter, rather than by a decision anybody took about them. Measured (`ui` 2026-07-30, `ai`
 *   2026-08-20): neither holds a hex, an `oklch(`, an `rgb(`/`hsl(` or a `color(` — zero colour
 *   notations of any kind, so nothing is hiding there today. That is worth writing down for the
 *   same reason ALLOWED below says why it is empty: an unexamined blind spot and a measured-empty
 *   one look identical from outside, and only one of them is a finding. A hue added to either file
 *   tomorrow would still pass. `logical-properties.test.ts` declares the same limit, from the same
 *   walk.
 * - **The corpus is `ui` and `ai`, derived** — see `guard-corpus.ts` for how, and for why
 *   `@kanzo-tech/palette` is deliberately not in it: a package whose subject is deriving hues would
 *   read as one long violation of a rule that is about hues written *by hand*.
 */

/**
 * Files whose subject matter *is* colour, where literals are the content rather than a decision.
 *
 * **Empty, and that is the finding.** It used to hold `simples/color-picker.tsx`, on the reasoning
 * that a colour picker must draw colours. Measured, every literal in that file is achromatic — the
 * `#e4e4e4` checkerboard, `rgba(0,0,0,0.1)` thumb rings, `#fff3`/`#0000` dot grid — so the rule
 * never applied to it and the exemption was covering nothing. An exemption that is never used is
 * indistinguishable from one that is hiding a defect, which is why it is gone rather than kept "in
 * case". Its `text-white` is not a hex and was never in scope; it is noted above instead.
 */
const ALLOWED = new Set<string>([]);

/** The twenty-two Tailwind v4 palette families. The five greys are in, deliberately — see above. */
const TAILWIND_FAMILIES =
  "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone";

/** Every Tailwind utility that takes a colour, so the rule is not spelled against `bg-` alone. */
const TAILWIND_UTILITIES =
  "bg|text|border(?:-[xytrbles])?|ring(?:-offset)?|outline|divide|placeholder|caret|accent|decoration|shadow|inset-shadow|fill|stroke|from|via|to|selection|marker";

const TAILWIND_PALETTE = new RegExp(
  `\\b(?:${TAILWIND_UTILITIES})-(?:${TAILWIND_FAMILIES})-(?:50|[1-9]00|950)\\b`,
  "g",
);

/* ── Every notation the platform lets you spell a colour in, normalised to one hex ───────────── */

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0")).join("")}`;

/** `50%` → 128 on a 0–255 axis, `128` → 128. `rgb()` accepts both and mixes them freely. */
const rgbComponent = (raw: string) =>
  raw.endsWith("%") ? (Number.parseFloat(raw) / 100) * 255 : Number.parseFloat(raw);

/** `color(srgb …)` components are gamma-encoded 0–1, which is `rgb()` over 255. Out of gamut clamps. */
const srgbComponent = (raw: string) =>
  (raw.endsWith("%") ? Number.parseFloat(raw) / 100 : Number.parseFloat(raw)) * 255;

function hslToHex(h: number, s: number, l: number): string {
  const [sat, lig] = [s / 100, l / 100];
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return toHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/**
 * CSS `lab()` is CIE Lab on the **D50** white point, so reaching sRGB is Lab → XYZ(D50) → Bradford
 * → XYZ(D65) → linear sRGB → gamma. Spelled out rather than pulled in, because the alternative is a
 * dependency in a guard test; the numbers are checked against six known colours below, so the
 * conversion cannot rot silently.
 */
const D50: [number, number, number] = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];
const BRADFORD_D50_TO_D65 = [
  [0.9554734527042182, -0.023098536874261423, 0.0632593086610217],
  [-0.028369706963208136, 1.0099954580058226, 0.021041398966943008],
  [0.012314001688319899, -0.020507696433477912, 1.3303659366080753],
];
const XYZ_TO_LINEAR_RGB = [
  [3.2409699419045226, -1.537383177570094, -0.4986107602930034],
  [-0.9692436362808796, 1.8759675015077202, 0.04155505740717559],
  [0.05563007969699366, -0.20397695888897652, 1.0569715142428786],
];

const apply = (m: number[][], v: number[]) =>
  m.map((row) => row.reduce((sum, cell, i) => sum + cell * (v[i] as number), 0));

function labToHex(L: number, a: number, b: number): string {
  const epsilon = 216 / 24389;
  const kappa = 24389 / 27;
  const fy = (L + 16) / 116;
  const inverse = (f: number) => (f ** 3 > epsilon ? f ** 3 : (116 * f - 16) / kappa);
  const xyz50 = [
    inverse(fy + a / 500) * D50[0],
    (L > kappa * epsilon ? fy ** 3 : L / kappa) * D50[1],
    inverse(fy - b / 200) * D50[2],
  ];
  const [r = 0, g = 0, bl = 0] = apply(XYZ_TO_LINEAR_RGB, apply(BRADFORD_D50_TO_D65, xyz50)).map(
    (u) => (u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(clamp(u, 0, 1), 1 / 2.4) - 0.055),
  );
  return toHex(r * 255, g * 255, bl * 255);
}

const polar = (L: number, C: number, H: number) =>
  labToHex(L, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180));

/**
 * One reader per notation. Each returns the OKLCh chroma of what was written, so the whole rule is
 * a single comparison against `CHROMA_FLOOR` no matter how the colour was spelled.
 *
 * The hex reader takes 3, 4, 6 and 8 digits. The four- and eight-digit forms are the gap that
 * mattered: with a trailing `\b` the old pattern could not see `#2563ebcc` at all — six digits then
 * failed the word boundary, three digits failed it too, and a fully saturated blue read as no match.
 * The alpha nibble is dropped; a translucent hue is still a hue somebody chose.
 *
 * The `&` in the lookbehind is not decoration. Admitting four digits admits HTML numeric entities,
 * and `pagination.tsx` writes a horizontal ellipsis as one — read as a colour it is a saturated
 * cyan, and it is the first thing the widened reader reported. An entity is a character reference,
 * never a colour, so the one byte in front of the `#` is what tells them apart.
 */
const READERS: { name: string; pattern: RegExp; chroma: (m: RegExpMatchArray) => number }[] = [
  {
    name: "hex",
    pattern:
      /(?<![&0-9a-zA-Z])#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g,
    chroma: ([, digits = ""]) => {
      const rgb = digits.length <= 4 ? [...digits.slice(0, 3)].map((c) => c + c) : [
        digits.slice(0, 2),
        digits.slice(2, 4),
        digits.slice(4, 6),
      ];
      return oklch(`#${rgb.join("")}`).c;
    },
  },
  {
    name: "rgb()",
    pattern: /\brgba?\(\s*(-?[\d.]+%?)[\s,]+(-?[\d.]+%?)[\s,]+(-?[\d.]+%?)[^)\n]*\)?/g,
    chroma: ([, r = "0", g = "0", b = "0"]) =>
      oklch(toHex(rgbComponent(r), rgbComponent(g), rgbComponent(b))).c,
  },
  {
    name: "hsl()",
    pattern: /\bhsla?\(\s*(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%[^)\n]*\)?/g,
    chroma: ([, h = "0", s = "0", l = "0"]) =>
      oklch(hslToHex(Number.parseFloat(h), Number.parseFloat(s), Number.parseFloat(l))).c,
  },
  {
    // OKLCh is the space `CHROMA_FLOOR` is *defined* in, so the number is read straight off. The
    // percentage form is relative to 0.4, which is what `oklch(x 100% y)` means.
    name: "oklch()",
    pattern: /\boklch\(\s*-?[\d.]+%?\s+([\d.]+%?)[^)\n]*\)?/g,
    chroma: ([, c = "0"]) =>
      c.endsWith("%") ? (Number.parseFloat(c) / 100) * 0.4 : Number.parseFloat(c),
  },
  {
    name: "lab()",
    pattern: /\blab\(\s*([\d.]+)%?\s+(-?[\d.]+)%?\s+(-?[\d.]+)%?[^)\n]*\)?/g,
    chroma: ([, L = "0", a = "0", b = "0"]) =>
      oklch(labToHex(Number.parseFloat(L), Number.parseFloat(a), Number.parseFloat(b))).c,
  },
  {
    name: "lch()",
    pattern: /\blch\(\s*([\d.]+)%?\s+([\d.]+)%?\s+(-?[\d.]+)[^)\n]*\)?/g,
    chroma: ([, L = "0", C = "0", H = "0"]) =>
      oklch(polar(Number.parseFloat(L), Number.parseFloat(C), Number.parseFloat(H))).c,
  },
  {
    // The one the repo already produces: `lib/token-color.ts` parses this serialisation because
    // Chrome answers a computed `--chart-N` with it, so it is a form a hand-written value can take.
    name: "color(srgb …)",
    pattern: /\bcolor\(\s*srgb\s+(-?[\d.]+%?)\s+(-?[\d.]+%?)\s+(-?[\d.]+%?)[^)\n]*\)?/g,
    chroma: ([, r = "0", g = "0", b = "0"]) =>
      oklch(toHex(srgbComponent(r), srgbComponent(g), srgbComponent(b))).c,
  },
];

/** Comments are prose: they quote the very hexes this rule is about, and quoting is not deciding. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

const FILES = sourceFiles();

/**
 * The corpus, stated so it cannot shrink without saying so.
 *
 * A floor rather than a count, because the point is not to freeze the file list — it is that a walk
 * which finds nothing, or a walk that stops descending, reports exactly the same green as a real
 * pass. Every subtree of every package is asked for a file of its own: `ui/charts/` and `ui/table/`
 * were the two that a non-recursive reader would have dropped, and they are the layers with the most
 * colour in them; `ai/` is the whole package that no scan in this directory read until 2026-08-20.
 * The list is derived from the tree rather than written out here, because a hand-written one can
 * only name the layers somebody remembered — which is the same not-seeing-the-corpus this guard is
 * built to fail on.
 */
describe("no literal hues in the source", () => {
  it("reads every source file in every package of the corpus, in every layer", () => {
    expect(
      FILES.length,
      "the walk found almost nothing — it is not reaching the packages' src/",
    ).toBeGreaterThan(100);
    for (const subtree of subtrees()) {
      const inSubtree = FILES.filter((f) => label(f).startsWith(subtree));
      expect(inSubtree.length, `${subtree} contributed no file to the scan`).toBeGreaterThan(0);
    }
  });

  it("reads a file with a NUL byte rather than skipping it", () => {
    // `charts/chart-inputs.tsx` once held a raw NUL, which makes `file(1)` and every `grep -I` treat
    // the largest file in the chart layer as binary and skip it in silence. `readFileSync(…, "utf8")`
    // reads it regardless, so this guard never had that hole — but a NUL is still a defect, and one
    // that would blind any tool a future reader reaches for first.
    const { binary, empty } = unreadable(FILES);
    expect(binary, "a NUL byte makes this file invisible to grep — strip it").toEqual([]);
    expect(empty, "an empty source file is a scan that proves nothing").toEqual([]);
  });

  it("leaves every chromatic colour to the theme", () => {
    const offenders: string[] = [];

    for (const file of FILES) {
      const rel = label(file);
      if (ALLOWED.has(rel)) continue;
      const source = stripComments(readFileSync(file, "utf8"));

      for (const { name, pattern, chroma } of READERS) {
        for (const match of source.matchAll(pattern)) {
          if (chroma(match) >= CHROMA_FLOOR) offenders.push(`${rel}: ${match[0]} (${name})`);
        }
      }
    }

    expect(
      offenders.sort(),
      `A hue written by hand cannot be validated, cannot follow the theme, and cannot be changed by\n` +
        `picking another palette. Use a token, or a scheme slot:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("leaves every palette family to the theme too", () => {
    const offenders: string[] = [];

    for (const file of FILES) {
      const rel = label(file);
      if (ALLOWED.has(rel)) continue;
      for (const [hit] of stripComments(readFileSync(file, "utf8")).matchAll(TAILWIND_PALETTE)) {
        offenders.push(`${rel}: ${hit}`);
      }
    }

    expect(
      offenders.sort(),
      `A Tailwind palette class is Tailwind's palette, not the tenant's — it moves when Tailwind\n` +
        `moves. Use a semantic family (bg-primary, text-muted-foreground, bg-chart-1):\n` +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("would catch a hue however it was spelled", () => {
    // The rule is only worth having if it bites — and it has to bite on chroma, not on the mere
    // presence of a literal, or every shadow in the codebase becomes a violation. Each notation is
    // checked on the same colour, so a reader that drifts is a reader that disagrees with the rest.
    const chromatic = (source: string) =>
      READERS.flatMap(({ pattern, chroma }) => [...source.matchAll(pattern)].map(chroma));

    for (const spelling of [
      "#2563eb",
      "#2563ebcc",
      "rgb(37, 99, 235)",
      "rgb(14.5% 38.8% 92.2%)",
      "hsl(217, 83%, 53%)",
      "oklch(0.546 0.215 262.9)",
      "lab(43.2% 27.6 -84.3)",
      "lch(43.2% 88.7 288.2)",
      "color(srgb 0.145 0.388 0.922)",
    ]) {
      const found = chromatic(spelling);
      expect(found, `${spelling} was not read at all`).not.toEqual([]);
      for (const c of found) expect(c, `${spelling} read as achromatic`).toBeGreaterThan(CHROMA_FLOOR);
    }

    for (const spelling of [
      "#000000",
      "#ffffff",
      "#fff3",
      "rgba(0, 0, 0, 0.08)",
      "hsl(0, 0%, 45%)",
      "oklch(0.145 0 0)",
      "lab(50% 0 0)",
      "lch(50% 0 0)",
      "color(srgb 0.61 0.61 0.61)",
    ]) {
      for (const c of chromatic(spelling)) {
        expect(c, `${spelling} read as chromatic`).toBeLessThan(CHROMA_FLOOR);
      }
    }

    // The D50 conversion above, against colours whose sRGB is not in dispute.
    expect(labToHex(54.29, 80.8, 69.89)).toBe("#ff0000");
    expect(labToHex(29.57, 68.3, -112.03)).toBe("#0000ff");
    expect(labToHex(87.82, -79.27, 80.99)).toBe("#00ff00");
    expect(labToHex(100, 0, 0)).toBe("#ffffff");
    expect(labToHex(0, 0, 0)).toBe("#000000");
    expect(polar(54.29, 106.84, 40.86)).toBe("#ff0000");

    // And the class half, which measures nothing and therefore has to be spelled correctly. The
    // examples are assembled from parts so that no whole class name exists in this file's bytes.
    const utility = (prefix: string, family: string, step: string, suffix = "") =>
      [prefix, family, step].join("-") + suffix;

    for (const [prefix, family, step, suffix] of [
      ["bg", "slate", "700", ""],
      ["text", "emerald", "50", ""],
      ["border-t", "rose", "950", ""],
      ["from", "fuchsia", "500", "/40"],
      ["ring-offset", "gray", "200", ""],
      ["stroke", "zinc", "900", ""],
    ] as [string, string, string, string][]) {
      const candidate = utility(prefix, family, step, suffix);
      expect(candidate.match(TAILWIND_PALETTE), `${candidate} was not caught`).not.toBeNull();
    }

    // Every family this repo *does* use is semantic, and none of them may trip it.
    for (const ours of ["primary", "chart-1", "sidebar-accent", "muted-foreground", "field"]) {
      const candidate = `bg-${ours}`;
      expect(candidate.match(TAILWIND_PALETTE), `${candidate} is a token, not a palette`).toBeNull();
    }
  });
});
