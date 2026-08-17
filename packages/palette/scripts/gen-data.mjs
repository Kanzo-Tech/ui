/*
 * gen-data.mjs — emits `packages/palette/palette-data.json`.
 *
 * The tables the derivation READS, and nothing else: Tailwind's chromatic families (`ramps`), the
 * named greys a base seed can be picked from (`baseSwatches`), the default categorical scheme,
 * the base16 sources, the seed pairs derived from them, the base16 → syntax role mapping and the
 * four status seeds.
 *
 * They live here rather than in `@kanzo-tech/theme` because they are inputs to the maths, not
 * outputs of it: a browser loads the compiled stylesheet and never one of these tables. Keeping
 * them beside the derivation is what lets `theme` depend on `palette` in one direction only — the
 * whole reason this package exists.
 *
 * Values are read off Tailwind's own `theme.css` rather than transcribed, because transcription is
 * how they rot: the swatch tables once carried v3 hexes while the theme resolved v4. Out-of-gamut
 * components are clamped per channel after conversion; the browser gamut-maps more carefully, so a
 * value can sit a hair off the rendered colour for the most saturated steps.
 *
 * Run: node packages/palette/scripts/gen-data.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── Tailwind's palette, resolved ─────────────────────────────────────────────
//
// Tailwind publishes its palette as `oklch()`, which nothing downstream parses, and only in a CSS
// file — which is why every table that needed these values used to be transcribed by hand and then
// rot (the swatch tables carried v3 hexes while the theme resolved v4). Out-of-gamut components are
// clamped per channel after conversion; the browser gamut-maps more carefully, so a value can sit a
// hair off the rendered colour for the most saturated steps.
const TW_THEME = readFileSync(
  createRequire(import.meta.url).resolve("tailwindcss/theme.css"),
  "utf8",
);
const TW_OKLCH = Object.fromEntries(
  [...TW_THEME.matchAll(/--color-([a-z]+)-(\d+):\s*(oklch\([^)]*\))/g)].map((m) => [
    `${m[1]}-${m[2]}`,
    m[3],
  ]),
);

const srgbFromOklch = (css) => {
  const [lRaw, cRaw, hRaw] = css.slice(6, -1).trim().split(/\s+/);
  // `none` is CSS Color 4 for a missing component, and Tailwind uses it for the hue of every
  // achromatic step (`oklch(55.6% 0 none)`) — the whole neutral family. Parsed naively it is NaN,
  // and NaN propagates all the way to a `#NaNNaNNaN` value rather than failing anywhere useful.
  const num = (raw) => (raw === "none" ? 0 : Number.parseFloat(raw));
  const L = num(lRaw) / (lRaw.endsWith("%") ? 100 : 1);
  const C = num(cRaw);
  const h = (num(hRaw) * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => {
    const clamped = Math.max(0, Math.min(1, v));
    const srgb = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
    return Math.round(srgb * 255);
  });
};
const hexOf = (name) => {
  const css = TW_OKLCH[name];
  if (!css) throw new Error(`no Tailwind colour "${name}" — the generated tables would ship a hole`);
  return `#${srgbFromOklch(css).map((n) => n.toString(16).padStart(2, "0")).join("")}`;
};

/**
 * The chromatic families and the steps a categorical slot can legally take.
 *
 * 400–700 covers both lightness bands with room to spare at each end; outside it a step is either
 * too pale for a light surface or too dark for a dark one, so offering more would only widen a
 * search that must reject them anyway. Read by `derive-scheme.ts`, which snaps a hue to a family.
 */
const CHROMATIC = [
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan",
  "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
];
const RAMP_STEPS = [400, 500, 600, 700];

/**
 * The named greys a base seed can be picked from — Tailwind's five plus Shark's four.
 *
 * A catalogue for onboarding, not an axis: the client supplies a base seed and these are the
 * ones with names. `neutral` is the one the package itself reads — `derive-palette.ts` uses it as
 * the lightness for a neutral constructed from a brand hue, and it is the Kanzo document's own
 * base seed. Only the mid-tone survives: the rest of each scale was `data-base`, and the ramp
 * generates its own steps now.
 */
const CUSTOM_MIDS = { mauve: "#79697b", olive: "#7c7c67", mist: "#67787c", taupe: "#7c6d67" };
const GREYS = ["slate", "gray", "zinc", "neutral", "stone", "mauve", "olive", "mist", "taupe"];
const baseSwatch = (name) => CUSTOM_MIDS[name] ?? hexOf(`${name}-500`);

// ── The default categorical scheme ───────────────────────────────────────────
//
// A scheme is the ordered set of colours carrying *identity* — which series, which node kind, which
// chip. It is no longer an axis: a tenant's set is a wheel spun off their brand hue (see
// `categoricalSource`). This is the answer for the one case that has no hue to spin — a brand below
// `CHROMA_FLOOR`, which is Kanzo's own, since Kanzo's identity is monochrome.
//
// Held as literal values, not as `var(--color-*)` references, because that is what the
// data-visualisation references do: d3 compiles its schemes as hex strings and Plot's model is that
// colour belongs to the **scale**, never to the mark. Eight slots because d3/Plot categorical
// schemes run 8–12 and never 5; the 5 in the old `--chart-1..5` is shadcn's UI-token convention
// leaking into data viz.
//
// Every scheme here clears every check `checkScheme` makes, in BOTH modes, measured against the product's
// real surfaces. `kanzo`: worst adjacent CVD ΔE 20.9, normal-vision 24.7, all eight at or above
// 3:1. Derived by enumerating Tailwind's families × steps × orderings against the validator.
// **Changing a value here means re-running that derivation, never nudging a hex** — four of the
// constraints that shaped this set are invisible to the gates: hue-group variants must not reach
// into a neighbour's arc, ranking must use the normal-vision worst pair (the CVD minimum saturates
// at eight slots), dark mode does not simply take the lighter steps (yellow-600 is past the dark
// band), and no leading slot may collide with `--destructive`.
const SCHEMES = {
  kanzo: {
    label: "Kanzo",
    relief: { light: 0, dark: 0 },
    light: ["#2b7fff", "#008236", "#7f22fe", "#a65f00", "#0092b8", "#f54a00", "#e12afb", "#ff2056"],
    dark: ["#2b7fff", "#00a63e", "#7f22fe", "#a65f00", "#0092b8", "#f54a00", "#e12afb", "#c70036"],
  },
  vivid: {
    label: "Vivid",
    // The same eight hues at the highest chroma that still clears every gate. CVD ΔE 23.1 light /
    // 20.9 dark, normal-vision 26.8 / 24.7. High chroma means light steps, and on a light surface
    // three of them land under 3:1, so the relief rule applies there.
    relief: { light: 3, dark: 0 },
    light: ["#155dfc", "#00c950", "#7f22fe", "#d08700", "#00b8db", "#f54a00", "#e12afb", "#ec003f"],
    dark: ["#155dfc", "#00a63e", "#7f22fe", "#a65f00", "#0092b8", "#f54a00", "#e12afb", "#ec003f"],
  },
};
/** Token count. Fixed, because a stylesheet cannot have a variable number of custom properties. */
const CHART_SLOTS = 8;
/** What a slot past a scheme's own capacity means. Never a colour — "not one of the categories". */
const OTHER = "var(--muted-foreground)";
const pad = (colours) => Array.from({ length: CHART_SLOTS }, (_, i) => colours[i] ?? OTHER);

// ── base16 sources ───────────────────────────────────────────────────────────
//
// A base16 palette is no longer a palette. It is a SEED PAIR — a brand hue and a neutral hue — that
// goes through `derivePalette` like any client's, because there is exactly one shape in the system
// and two shapes for one idea is the defect this layer exists to remove. What survives here is the
// authored strip itself, for two consumers and no others:
//
//  · the 13 `--kanzo-syntax-*` roles, which are Kanzo's own slots through the base16 role mapping
//    below and stay Kanzo-fixed per tenant — a client's brand does not repaint keywords;
//  · the docs showcase, which displays the authored original beside the derived result. That
//    comparison IS the demonstration: a ramp keeps a foreign seed's hue and loses its mood, so
//    Dracula's `#50fa7b` comes back as `#00a843` — same hue, different place.
//
// `appearance`, `pairsWith`, the declared brand/status roles and their provenance are all gone: a
// document carries both modes, so there is no pair to resolve and no dark-only palette to pin.
const SLOT_NAMES = [
  "base00", "base01", "base02", "base03", "base04", "base05", "base06", "base07",
  "base08", "base09", "base0A", "base0B", "base0C", "base0D", "base0E", "base0F",
];

/**
 * base16 roles → the 13 syntax tokens, following the base16 styling guidelines.
 *
 * A mapping that follows the convention makes any published base16 palette land correctly, while
 * one tuned to our own hues would only ever look right in our own palette. base00–base05 run
 * background → ink, so comments (base03) sit closer to the background than punctuation (base04).
 */
const SYNTAX = {
  keyword: "base0E",
  string: "base0B",
  number: "base09",
  constant: "base09",
  comment: "base03",
  type: "base0A",
  function: "base0D",
  property: "base0C",
  identifier: "base08",
  operator: "base05",
  punctuation: "base04",
  url: "base0D",
  invalid: "base0F",
};

/** Kanzo's own pair, read off Tailwind's ramps rather than transcribed — no hue written by hand. */
const kanzoSlots = (neutrals, step) => ({
  ...Object.fromEntries(neutrals.map((shade, i) => [SLOT_NAMES[i], hexOf(`neutral-${shade}`)])),
  base08: hexOf(`red-${step}`),
  base09: hexOf(`orange-${step}`),
  // `yellow`, not `amber`: base09 is already orange, and orange-700/amber-700 are close enough that
  // a number and a type would have read as the same colour.
  base0A: hexOf(`yellow-${step}`),
  base0B: hexOf(`emerald-${step}`),
  base0C: hexOf(`cyan-${step}`),
  base0D: hexOf(`blue-${step}`),
  base0E: hexOf(`purple-${step}`),
  base0F: hexOf(`rose-${step}`),
});

const PALETTES = {
  kanzo: {
    label: "Kanzo",
    // `-500`/`-600` for base03/base04, not `-400`/`-500`: base16 orders the ramp monotonically from
    // background to ink, and taking the shades `tokens.css` used put comments at 2.5:1 on `-50`.
    // A comment is small text, so it owes 4.5:1 like any other.
    slots: kanzoSlots([50, 100, 200, 500, 600, 800, 900, 950], 700),
  },
  "kanzo-dark": {
    label: "Kanzo Dark",
    // base07 is white outright: the ramp stops at `-50`, which is already base06.
    slots: { ...kanzoSlots([950, 900, 800, 400, 300, 100, 50], 400), base07: "#ffffff" },
  },
  // Kanzo's own slots, and the difference is one field in the seed: this document **declines the
  // categorical channel** (`categorical: "declined"` below), so it publishes no `--chart-*` colours
  // and no capacity. Everything else about it is Kanzo, which is the point — flip between the two
  // and the only thing that moves is what carries a category.
  //
  // The accent slots are still here and still Kanzo's. They are what `deriveSyntax` reads, and a
  // syntax role is a distinction *in the thing you are reading* — a keyword against a string —
  // rather than a label somebody assigned. Statuses stay for the same reason one layer up. What
  // this document declines is identity-by-colour, not colour.
  monochrome: {
    label: "Monochrome",
    slots: kanzoSlots([50, 100, 200, 500, 600, 800, 900, 950], 700),
  },
  // Dracula's published spec names four greys and seven accents, so base0F repeats the red (base16
  // reserves it for "deprecated", which Dracula has no colour for) and base06/07 it does not name.
  dracula: {
    label: "Dracula",
    slots: {
      base00: "#282a36", base01: "#363948", base02: "#44475a", base03: "#6272a4",
      base04: "#a3a6be", base05: "#f8f8f2",
      base08: "#ff5555", base09: "#ffb86c", base0A: "#f1fa8c", base0B: "#50fa7b",
      base0C: "#8be9fd", base0D: "#bd93f9", base0E: "#ff79c6", base0F: "#ff5555",
    },
  },
  // Nord ships sixteen numbered colours and a published base16 port. base00–base04 are nord0–nord4;
  // base05/base06 are nord6/nord5, not in numeric order; base07 is nord**7**, a Frost accent, since
  // base16 wants eight neutral slots and Nord names seven. Seven of its eight accents sit below the
  // chroma floor, which is why its derived categorical set falls back to Kanzo's own: Nord has hues
  // to *look* like and none to chart with.
  nord: {
    label: "Nord",
    slots: {
      base00: "#2e3440", base01: "#3b4252", base02: "#434c5e", base03: "#4c566a",
      base04: "#d8dee9", base05: "#eceff4", base06: "#e5e9f0", base07: "#8fbcbb",
      base08: "#bf616a", base09: "#d08770", base0A: "#ebcb8b", base0B: "#a3be8c",
      base0C: "#88c0d0", base0D: "#81a1c1", base0E: "#b48ead", base0F: "#5e81ac",
    },
  },
  "catppuccin-latte": {
    label: "Catppuccin Latte",
    slots: {
      base00: "#eff1f5", base01: "#e6e9ef", base02: "#ccd0da", base03: "#9ca0b0",
      base04: "#6c6f85", base05: "#4c4f69",
      base08: "#d20f39", base09: "#fe640b", base0A: "#df8e1d", base0B: "#40a02b",
      base0C: "#179299", base0D: "#1e66f5", base0E: "#8839ef", base0F: "#e64553",
    },
  },
  "catppuccin-mocha": {
    label: "Catppuccin Mocha",
    slots: {
      base00: "#1e1e2e", base01: "#313244", base02: "#45475a", base03: "#6c7086",
      base04: "#9399b2", base05: "#cdd6f4",
      base08: "#f38ba8", base09: "#fab387", base0A: "#f9e2af", base0B: "#a6e3a1",
      base0C: "#94e2d5", base0D: "#89b4fa", base0E: "#cba6f7", base0F: "#eba0ac",
    },
  },
};

/**
 * The brand seed of each identity — the one value a source designates and a ramp cannot infer.
 *
 * Two findings worth not re-deriving. **Nord designates its own primary**: `nord.css` says of nord8
 * "Main color for primary UI elements", so daisyUI's choice of nord10 is simply wrong. And
 * **Dracula designates no brand at all** — "primary" and "brand" appear nowhere in a spec scoped to
 * syntax highlighting — so its pink is an ecosystem convention rather than the project's word.
 *
 * Kanzo's is its own base: this system has no chromatic brand and never had one. That is not a
 * gap to fill — it makes the default tenant the honest test of the grey-brand path, which
 * `derivePalette` answers by keeping the default categorical scheme and reporting
 * `carries-identity` as relief on the brand ramp.
 */
const BRANDS = {
  kanzo: hexOf("neutral-500"),
  // The same grey, and it has to be: a monochrome document with a chromatic brand would spend
  // colour on the one mark a reader cannot avoid — the primary fill — while refusing it to the
  // marks that are actually about telling categories apart.
  monochrome: hexOf("neutral-500"),
  dracula: "#ff79c6",
  nord: "#88c0d0",
  "catppuccin-latte": "#8839ef",
  "catppuccin-mocha": "#cba6f7",
};

/**
 * The seed pairs — what a tenant document is derived from, and the only shape colour comes in.
 *
 * The base seed is **base03**, by the rule rather than by transcription: base16 orders base00–
 * base05 background → ink, so base03 is the mid-tone of the base ramp — and for Kanzo it lands
 * on `neutral-500`, which is exactly the swatch `derive-palette.ts` reads as its own base. The
 * tint comes with it: Dracula's base03 is `#6272a4`, and that violet is why Dracula's surfaces do
 * not read as grey.
 *
 * `kanzo-dark` is not here. It is the dark half of one identity, and a document carries both modes.
 */
const SEEDS = Object.fromEntries(
  Object.entries(BRANDS).map(([id, brand]) => [
    id,
    {
      label: PALETTES[id].label,
      brand,
      base: PALETTES[id].slots.base03,
      // The one seed that declines the categorical channel — see `PALETTES.monochrome` and
      // `decisions/monochrome-is-a-palette-not-a-look.md`. A field rather than a rule about grey
      // brands: Kanzo's brand is this same grey and Kanzo publishes eight chart colours, so
      // declining is something a tenant *says*, never something a hue implies.
      ...(id === "monochrome" ? { categorical: "declined" } : {}),
    },
  ]),
);

/**
 * The four status seeds — Kanzo's, fixed, and never the client's: a state must mean the same thing
 * in every tenant. Every obligation they carry is re-measured against the tenant's own page, which
 * is what `PaletteRecord.crossChecks` records.
 *
 * All four sit at `-600` rather than Tailwind's `-500`, a divergence from Shark this package
 * already paid for and measured: red-500 carries neither white (3.81) nor near-black (4.15) at AA,
 * and emerald-500/amber-500 measure 2.37 and 2.05 against the page, so a filled badge was barely
 * visible as a shape.
 *
 * `content` is the ink those fills shipped with. The document derives its own now — `Ramp.onSolid`,
 * whatever measures highest — so this is the record of what was measured, not what is emitted.
 */
const STATUS_INK = {
  destructive: { fill: "red-600", content: "white" },
  info: { fill: "blue-600", content: "white" },
  success: { fill: "emerald-600", content: "neutral-950" },
  warning: { fill: "amber-600", content: "neutral-950" },
};
const resolveInk = (name) => (name === "white" ? "#ffffff" : hexOf(name));

// ── Emit ─────────────────────────────────────────────────────────────────────
const data = {
  // The chromatic families as hex, so a derivation can run in plain JS.
  ramps: Object.fromEntries(
    CHROMATIC.map((hue) => [hue, Object.fromEntries(RAMP_STEPS.map((s) => [s, hexOf(`${hue}-${s}`)]))]),
  ),
  baseSwatches: Object.fromEntries(GREYS.map((b) => [b, baseSwatch(b)])),
  // `slots` is the scheme's *capacity* — how many real categories it can name. The arrays stay
  // eight long so the token count lines up; a ninth series folds to Other.
  schemes: Object.fromEntries(
    Object.entries(SCHEMES).map(([name, s]) => [
      name,
      { ...s, slots: s.light.length, light: pad(s.light), dark: pad(s.dark) },
    ]),
  ),
  defaultScheme: "kanzo",
  palettes: PALETTES,
  seeds: SEEDS,
  syntaxRoles: SYNTAX,
  // The status seeds RESOLVED to hex, per mode. A `var()` reference cannot be measured — which is
  // precisely how `text-white` sat at 2.13:1 on the warning fill without anything noticing. Both
  // modes carry the same values: a state does not change hue when the mode flips.
  statusInk: Object.fromEntries(
    ["light", "dark"].map((mode) => [
      mode,
      Object.fromEntries(
        Object.entries(STATUS_INK).map(([role, { fill, content }]) => [
          role,
          { fill: resolveInk(fill), content: resolveInk(content) },
        ]),
      ),
    ]),
  ),
};
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "palette-data.json");
writeFileSync(OUT, JSON.stringify(data, null, 2));
