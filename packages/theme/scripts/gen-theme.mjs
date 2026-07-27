/*
 * gen-theme.mjs — emits `packages/theme/themes.css` from Shark UI's exact theme data
 * (its `/themes` GRAY_COLORS / PRIMARY_COLORS / BORDER_RADIUS, verbatim colour/radius math).
 *
 * MECHANISM (canonical, matches keasy + tweakcn): theming is driven by `data-*` attributes
 * on <html> (NOT classes). `data-palette` sets a whole base16 colour identity (surfaces + syntax +
 * `color-scheme`), `data-base` sets the neutral scale, `data-accent` overrides the 6
 * accent tokens, `data-radius` sets --radius, `data-font`/`data-mono-font` set the font stacks,
 * and `data-font-size` sets the density (root font-size). Dark is owned by next-themes (`.dark`
 * on <html>); we emit dark overrides matching `.dark` on the same element OR an ancestor
 * (`.dark[data-x], .dark [data-x]`). The default value of every axis = attribute ABSENT (the
 * neutral/system defaults in tokens.css apply), so a product only sets what it changes.
 *
 * Run: node packages/theme/scripts/gen-theme.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "themes.css");

// ── Base colours (GRAY_COLORS) — Tailwind built-ins + 4 custom scales + a runtime "custom"
//    scale whose `--color-custom-*` shades are injected inline by the provider from a user tint. ─
const BASES = ["slate", "gray", "zinc", "neutral", "stone", "mauve", "olive", "mist", "taupe", "custom"];

// The 4 custom scales (only the 6 shades the formulas reference exist upstream).
const CUSTOM_SCALES = {
  mauve: { 50: "#fafafa", 100: "#f3f1f3", 400: "#a89ea9", 500: "#79697b", 800: "#2a212c", 950: "#0c090c" },
  olive: { 50: "#fbfbf9", 100: "#f4f4f0", 400: "#abab9c", 500: "#7c7c67", 800: "#2b2b22", 950: "#0c0c09" },
  mist: { 50: "#f9fbfb", 100: "#f1f3f3", 400: "#9ca8ab", 500: "#67787c", 800: "#22292b", 950: "#090b0c" },
  taupe: { 50: "#fbfaf9", 100: "#f3f1f1", 400: "#aba09c", 500: "#7c6d67", 800: "#2b2422", 950: "#0c0a09" },
};

// Base token template (light/dark). Excludes primary/ring/sidebar-primary/sidebar-ring
// (those come from the accent) and light destructive/info/success/warning/chart (static,
// in tokens.css). Dark destructive IS base-derived, so it lives here.
const baseLight = (c) => ({
  "--background": `var(--color-${c}-50)`,
  "--foreground": `var(--color-${c}-800)`,
  "--card": `var(--color-${c}-50)`,
  "--card-foreground": `var(--color-${c}-800)`,
  "--popover": `var(--color-${c}-50)`,
  "--popover-foreground": `var(--color-${c}-800)`,
  "--secondary": `color-mix(in srgb, var(--color-${c}-950) 6%, var(--background))`,
  "--secondary-foreground": `var(--color-${c}-800)`,
  "--muted": `color-mix(in srgb, var(--color-${c}-950) 6%, var(--background))`,
  "--muted-foreground": `color-mix(in srgb, var(--color-${c}-500) 80%, var(--color-${c}-950))`,
  "--accent": `color-mix(in srgb, var(--color-${c}-950) 6%, var(--background))`,
  "--accent-foreground": `var(--color-${c}-800)`,
  "--border": `color-mix(in srgb, var(--color-${c}-950) 12%, var(--background))`,
  "--input": `color-mix(in srgb, var(--color-${c}-950) 13%, var(--background))`,
  "--sidebar": `var(--color-${c}-50)`,
  "--sidebar-foreground": `color-mix(in srgb, var(--color-${c}-800) 64%, var(--sidebar))`,
  "--sidebar-accent": `color-mix(in srgb, var(--color-${c}-950) 6%, var(--sidebar))`,
  "--sidebar-accent-foreground": `var(--color-${c}-800)`,
  "--sidebar-border": `color-mix(in srgb, var(--color-${c}-950) 11%, var(--sidebar))`,
});
const baseDark = (c) => ({
  "--background": `var(--color-${c}-950)`,
  "--foreground": `var(--color-${c}-100)`,
  "--card": `color-mix(in srgb, var(--background) 98%, var(--color-${c}-50))`,
  "--card-foreground": `var(--color-${c}-100)`,
  "--popover": `color-mix(in srgb, var(--background) 96%, var(--color-${c}-50))`,
  "--popover-foreground": `var(--color-${c}-100)`,
  "--secondary": `color-mix(in srgb, var(--color-${c}-50) 8%, var(--background))`,
  "--secondary-foreground": `var(--color-${c}-100)`,
  "--muted": `color-mix(in srgb, var(--color-${c}-50) 8%, var(--background))`,
  "--muted-foreground": `color-mix(in srgb, var(--color-${c}-500) 70%, var(--color-${c}-50))`,
  "--accent": `color-mix(in srgb, var(--color-${c}-50) 8%, var(--background))`,
  "--accent-foreground": `var(--color-${c}-100)`,
  "--border": `color-mix(in srgb, var(--color-${c}-50) 12%, var(--background))`,
  "--input": `color-mix(in srgb, var(--color-${c}-50) 13%, var(--background))`,
  "--destructive": `color-mix(in srgb, var(--color-red-600) 90%, var(--color-${c}-50))`,
  "--destructive-foreground": `var(--color-red-400)`,
  "--sidebar": `color-mix(in srgb, var(--color-${c}-950) 97%, var(--color-${c}-50))`,
  "--sidebar-foreground": `color-mix(in srgb, var(--color-${c}-100) 64%, var(--sidebar))`,
  "--sidebar-accent": `color-mix(in srgb, var(--color-${c}-50) 8%, var(--sidebar))`,
  "--sidebar-accent-foreground": `var(--color-${c}-100)`,
  "--sidebar-border": `color-mix(in srgb, var(--color-${c}-50) 11%, var(--sidebar))`,
});

// ── Accents (PRIMARY_COLORS) — exact per-hue shades, verbatim ────────────────
// [value, lightPrimary, lightRing, lightPf, darkPrimary, darkRing, darkPf]
const ACCENTS = [
  ["neutral", 800, 400, 50, 100, 500, 800],
  ["red", 600, 500, 50, 700, 900, 50],
  ["orange", 600, 400, 50, 700, 900, 50],
  ["amber", 600, 500, 50, 700, 900, 50],
  ["yellow", 600, 500, 50, 700, 900, 50],
  ["lime", 600, 600, 50, 700, 900, 50],
  ["green", 600, 600, 50, 700, 900, 50],
  ["emerald", 600, 600, 50, 700, 900, 50],
  ["teal", 600, 600, 50, 700, 900, 50],
  ["cyan", 600, 600, 50, 700, 900, 50],
  ["sky", 600, 600, 50, 700, 900, 50],
  ["blue", 600, 400, 50, 600, 900, 50],
  ["indigo", 600, 400, 50, 500, 900, 50],
  ["violet", 600, 400, 50, 500, 900, 50],
  ["purple", 600, 400, 50, 500, 900, 50],
  ["fuchsia", 600, 400, 50, 500, 900, 50],
  ["pink", 600, 400, 50, 500, 900, 50],
  ["rose", 600, 400, 50, 500, 900, 50],
];
const accentVars = (a, primary, ring, pf) => ({
  "--primary": `var(--color-${a}-${primary})`,
  "--primary-foreground": `var(--color-${a}-${pf})`,
  "--ring": `var(--color-${a}-${ring})`,
  "--sidebar-primary": `var(--color-${a}-${primary})`,
  "--sidebar-primary-foreground": `var(--color-${a}-${pf})`,
  "--sidebar-ring": `var(--color-${a}-${ring})`,
});

// ── Radius (BORDER_RADIUS) ───────────────────────────────────────────────────
const RADII = [["none", "0rem"], ["xs", "0.125rem"], ["sm", "0.25rem"], ["md", "0.5rem"], ["lg", "0.625rem"]];

// ── Curated accent set surfaced in the product Preferences panel (keasy's names).
//    The full ACCENTS set stays generated for the playground theme-editor. ──
const CURATED_ACCENTS = ["neutral", "blue", "green", "violet", "orange", "rose"];

// ── Swatches — the concrete colour a picker shows for a NAMED axis value ──────
//
// Generated, because hand-writing them is how they rot: the panel carried Tailwind **v3** hexes
// (`#2563eb` for blue) while the theme resolves `--color-blue-600` to v4's `#155dfc`. The swatch
// and the thing it stands for had quietly become different colours.
//
// Tailwind publishes its palette as `oklch()`, which no picker parses, so the values are converted
// here. Out-of-gamut components are clamped per channel after conversion — the browser gamut-maps
// more carefully, so a swatch can sit a hair off the rendered colour for the most saturated steps.
// That is fine for a swatch and would not be fine for a chart slot, which is why the chart schemes
// are measured hexes rather than anything derived here.
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
  // and NaN propagates all the way to a `#NaNNaNNaN` swatch rather than failing anywhere useful.
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
  if (!css) throw new Error(`no Tailwind colour "${name}" — the swatch tables would ship a hole`);
  return `#${srgbFromOklch(css).map((n) => n.toString(16).padStart(2, "0")).join("")}`;
};

/**
 * The chromatic families and the steps a categorical slot can legally take.
 *
 * 400–700 covers both lightness bands with room to spare at each end; outside it a step is either
 * too pale for a light surface or too dark for a dark one, so offering more would only widen a
 * search that must reject them anyway.
 */
const CHROMATIC = [
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan",
  "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
];
const RAMP_STEPS = [400, 500, 600, 700];

/** A base scale's swatch: the mid-tone that reads as "this is the grey family". */
const baseSwatch = (name) =>
  CUSTOM_SCALES[name] ? CUSTOM_SCALES[name][500] : hexOf(`${name}-500`);
/** An accent's swatch: the exact shade `--primary` takes in light mode, so it cannot lie. */
const accentSwatch = (name) => {
  const row = ACCENTS.find(([a]) => a === name);
  return hexOf(`${name}-${row[1]}`);
};

// ── Categorical schemes (data-chart-scheme) ──────────────────────────────────
//
// A scheme is the ordered set of colours carrying *identity* — which series, which node kind,
// which chip. It is the fourth colour axis, and the one Shark has no counterpart for: its theme
// editor offers neutral, primary and radius only, and it ships no charts.
//
// Held as literal values, not as `var(--color-*)` references, because that is what the
// data-visualisation references do. d3 compiles its schemes as hex strings and Plot's model is that
// colour belongs to the **scale**, never to the mark — so the `--chart-*` tokens emitted below are
// a *projection* of this data, and `packages/ui` reads the same entry straight from
// theme-data.json. One source, two outputs.
//
// Eight slots because d3/Plot categorical schemes run 8–12 and never 5; the 5 in the old
// `--chart-1..5` is shadcn's UI-token convention leaking into data viz.
//
// Every scheme here clears all six categorical checks in BOTH modes, measured against the
// product's real surfaces rather than a validator default. `kanzo`: worst adjacent CVD ΔE 20.9,
// normal-vision 24.7, all eight at or above 3:1, all-pairs cap 3 slots. It replaces two palettes
// that did not: the old static tokens failed outright (light `--chart-4`/`--chart-5` were two
// adjacent ambers at ΔE 7.4, below the 15 floor, and `--chart-3` was below the chroma floor, so it
// read as grey), and `charts/theme.ts`'s hardcoded eight sat in the CVD warn band at 6.1.
//
// Derived by enumerating Tailwind's families × steps × orderings against the validator. **Changing
// a value here means re-running that derivation, never nudging a hex** — four of the constraints
// that shaped this set are invisible to the gates: hue-group variants must not reach into a
// neighbour's arc, ranking must use the normal-vision worst pair (the CVD minimum saturates at
// eight slots), dark mode does not simply take the lighter steps (yellow-600 is past the dark
// band), and no leading slot may collide with `--destructive` (red-500) — which is why red sits
// in slot 8.
// A scheme varies the STEPS, never the hues or their order: the order is the CVD-safety mechanism
// and it was derived once, so switching schemes cannot quietly make a chart less readable. Every
// entry clears all six checks in both modes. `relief` records the slots that fall below 3:1 on
// their surface — a documented conditional relax rather than a failure, but not a dismissable one:
// where it is non-zero the chart owes visible direct labels or a table view.
const SCHEMES = {
  kanzo: {
    label: "Kanzo",
    // Worst adjacent CVD ΔE 20.9 both modes, normal-vision 24.7, every slot at or above 3:1.
    relief: { light: 0, dark: 0 },
    light: ["#2b7fff", "#008236", "#7f22fe", "#a65f00", "#0092b8", "#f54a00", "#e12afb", "#ff2056"],
    dark: ["#2b7fff", "#00a63e", "#7f22fe", "#a65f00", "#0092b8", "#f54a00", "#e12afb", "#c70036"],
  },
  vivid: {
    label: "Vivid",
    // The same eight hues at the highest chroma that still clears every gate — the register the
    // graph's Nebula look used to keep to itself, now a product-wide choice that charts and tables
    // can wear too. CVD ΔE 23.1 light / 20.9 dark, normal-vision 26.8 / 24.7. High chroma means
    // light steps, and on a light surface three of them land under 3:1, so the relief rule applies
    // there: pick this one for a dark product, or ship the labels.
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

/**
 * A scheme's slots as CSS, always all eight.
 *
 * Padding is the point. A scheme with fewer real colours than there are tokens — a palette that
 * yields six usable hue families, say — would otherwise leave `--chart-7` and `--chart-8` at their
 * `:root` defaults, so a chart with seven series would silently mix two schemes and nothing would
 * say so. Filling the tail with the muted token makes the overflow explicit and correct: past its
 * capacity a scheme has no more categories, and that is what "Other" is.
 */
const schemeVars = (colours) =>
  Object.fromEntries(
    Array.from({ length: CHART_SLOTS }, (_, i) => [`--chart-${i + 1}`, colours[i] ?? OTHER]),
  );

// ── Palettes (data-palette) — base16 ─────────────────────────────────────────
//
// A palette is the colour IDENTITY: one named object from which the neutrals, the surfaces and the
// syntax colours all follow. The reference is daisyUI, where a theme is the user-facing choice and
// `color-scheme` is a property OF the theme rather than a second axis crossed with it.
//
// Shape is base16 — sixteen slots with documented roles — because that is the interchange format
// these palettes already exist in, and because `tokens.css` had independently grown 13
// `--kanzo-syntax-*` roles, which is the exact mapping base16 was designed for. A palette is the
// data; SYNTAX below is the mapping. That separation is what lets one palette dress an editor and
// a UI without either owning the other.
//
// What a palette does NOT own, and why:
//  · **accent/primary** — still `data-accent`. base16 nominates no primary, so picking one would be
//    this file inventing brand from a syntax slot.
//  · **status** (destructive/info/success/warning) — base16's red/yellow/green slots mean *strings*
//    and *classes*, not *success* and *warning*; wiring them across would make a palette able to
//    say "this succeeded" in whatever hue it happens to use for literals. The system's status hues
//    are emitted into each block instead, stepped for that palette's appearance, so a palette block
//    is self-sufficient for its own appearance without borrowing meaning it does not have.
//  · **the chart scheme** — derived, never mapped: `deriveScheme` exists precisely because no named
//    palette passes the categorical checks in its own values. That derivation is authoring-time and
//    lands with its measured numbers, the way `vivid` did.
const SLOT_NAMES = [
  "base00", "base01", "base02", "base03", "base04", "base05", "base06", "base07",
  "base08", "base09", "base0A", "base0B", "base0C", "base0D", "base0E", "base0F",
];

/**
 * base16 roles → the 13 syntax tokens, following the base16 styling guidelines rather than
 * `tokens.css`'s previous ad-hoc hues.
 *
 * This moves seven of the thirteen (identifier teal→base08, type blue→base0A, function rose→base0D,
 * property sky→base0C, url indigo→base0D, invalid destructive→base0F, number amber→base09), and the
 * move is the point: a mapping that follows the convention makes any published base16 palette land
 * correctly, while one tuned to our own hues would only ever look right in our own palette. base03
 * and base04 also swap relative to before — the spec orders the neutral ramp monotonically from
 * background to ink, so comments sit closer to the background than punctuation, where `tokens.css`
 * had them the other way round in both modes.
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

const mix = (a, pct, b) => `color-mix(in srgb, ${a} ${pct}%, ${b})`;

/**
 * The status families — the system's hues, not the palette's, and stepped for each appearance.
 *
 * A palette does not own these: base16's red/yellow/green slots mean *strings* and *classes*, so
 * borrowing them would let a palette say "this succeeded" in whatever hue it uses for literals.
 * They are emitted into every palette block anyway, so a block is self-sufficient for its own
 * appearance rather than depending on `.dark` also being present.
 *
 * Three tokens per family, and the third is new. `-foreground` is a readable-on-the-page variant of
 * the same hue (~40 call sites rely on that, and it is Shark's contract); `-content` is the ink that
 * sits ON the fill, which until now was a literal `text-white` failing AA at warning 2.13, success
 * 2.47, info 3.76 and destructive 3.81. destructive and info moved to `-600` because red-500 holds
 * neither white nor black at AA; success and warning keep their fill and take near-black instead.
 */
const STATUS_LIGHT = {
  "--destructive": "var(--color-red-600)",
  "--destructive-foreground": "var(--color-red-700)",
  "--destructive-content": "var(--color-white)",
  "--info": "var(--color-blue-600)",
  "--info-foreground": "var(--color-blue-700)",
  "--info-content": "var(--color-white)",
  "--success": "var(--color-emerald-600)",
  "--success-foreground": "var(--color-emerald-700)",
  "--success-content": "var(--color-neutral-950)",
  "--warning": "var(--color-amber-600)",
  "--warning-foreground": "var(--color-amber-700)",
  "--warning-content": "var(--color-neutral-950)",
};
/** Dark `--destructive` is base-derived, so it is set beside this rather than in it. */
const STATUS_DARK = {
  "--destructive-foreground": "var(--color-red-400)",
  "--destructive-content": "var(--color-white)",
  "--info": "var(--color-blue-600)",
  "--info-foreground": "var(--color-blue-400)",
  "--info-content": "var(--color-white)",
  "--success": "var(--color-emerald-600)",
  "--success-foreground": "var(--color-emerald-400)",
  "--success-content": "var(--color-neutral-950)",
  "--warning": "var(--color-amber-600)",
  "--warning-foreground": "var(--color-amber-400)",
  "--warning-content": "var(--color-neutral-950)",
};

/**
 * Blend two hexes the way `color-mix(in srgb, …)` does — a plain linear blend of the gamma-encoded
 * channels. Used only to manufacture the slots a source palette does not document.
 */
const blend = (a, b, t) => {
  const ch = (hex) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  const [x, y] = [ch(a), ch(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
};

/**
 * Normalise a source to all sixteen slots.
 *
 * Every palette documents base00–base05 (background, raised surface, selection, comment, dim ink,
 * ink) and eight accents; almost none documents base06/base07, the two "light foreground / light
 * background" slots — Dracula defines four greys where base16 wants eight, and Catppuccin's own
 * base16 port gives up and puts *accents* there. Rather than transcribe an invented hex per
 * palette, the missing slots are generated by carrying base05 further toward the ink extreme, and
 * the result records which ones were manufactured. The surface math below never reads base06/07
 * precisely so that this manufacturing cannot reach a rendered token.
 */
const fillSlots = (src, appearance) => {
  const ink = appearance === "light" ? "#000000" : "#ffffff";
  const slots = { ...src };
  const extended = [];
  for (const [name, t] of [["base06", 0.25], ["base07", 0.5]]) {
    if (slots[name]) continue;
    slots[name] = blend(src.base05, ink, t);
    extended.push(name);
  }
  const missing = SLOT_NAMES.filter((s) => !slots[s]);
  if (missing.length) throw new Error(`palette is missing ${missing.join(", ")}`);
  return { slots, extended };
};

/**
 * A palette's surface tokens.
 *
 * Shark's colour math verbatim — the same six/eight/twelve/thirteen-percent mixes `baseLight` and
 * `baseDark` use — with one substitution: the mix partner is **base05**, the palette's ink, where
 * the base scales reach past the foreground to `-950`/`-50`. base16 guarantees an ink slot and does
 * not guarantee a step beyond it, and reading base06/07 here would let a manufactured value into a
 * border. The cost is measured, not waved: for `kanzo` it moves `--border` by six sRGB values.
 */
const paletteLight = (p) => ({
  "--background": p.base00,
  "--foreground": p.base05,
  "--card": p.base00,
  "--card-foreground": p.base05,
  "--popover": p.base00,
  "--popover-foreground": p.base05,
  "--secondary": mix(p.base05, 6, "var(--background)"),
  "--secondary-foreground": p.base05,
  "--muted": mix(p.base05, 6, "var(--background)"),
  "--muted-foreground": mix(p.base04, 80, p.base05),
  "--accent": mix(p.base05, 6, "var(--background)"),
  "--accent-foreground": p.base05,
  "--border": mix(p.base05, 12, "var(--background)"),
  "--input": mix(p.base05, 13, "var(--background)"),
  "--sidebar": p.base00,
  "--sidebar-foreground": mix(p.base05, 64, "var(--sidebar)"),
  "--sidebar-accent": mix(p.base05, 6, "var(--sidebar)"),
  "--sidebar-accent-foreground": p.base05,
  "--sidebar-border": mix(p.base05, 11, "var(--sidebar)"),
});
const paletteDark = (p) => ({
  "--background": p.base00,
  "--foreground": p.base05,
  "--card": mix("var(--background)", 98, p.base05),
  "--card-foreground": p.base05,
  "--popover": mix("var(--background)", 96, p.base05),
  "--popover-foreground": p.base05,
  "--secondary": mix(p.base05, 8, "var(--background)"),
  "--secondary-foreground": p.base05,
  "--muted": mix(p.base05, 8, "var(--background)"),
  "--muted-foreground": mix(p.base04, 80, p.base05),
  "--accent": mix(p.base05, 8, "var(--background)"),
  "--accent-foreground": p.base05,
  "--border": mix(p.base05, 12, "var(--background)"),
  "--input": mix(p.base05, 13, "var(--background)"),
  "--sidebar": mix(p.base00, 97, p.base05),
  "--sidebar-foreground": mix(p.base05, 64, "var(--sidebar)"),
  "--sidebar-accent": mix(p.base05, 8, "var(--sidebar)"),
  "--sidebar-accent-foreground": p.base05,
  "--sidebar-border": mix(p.base05, 11, "var(--sidebar)"),
});

/** Kanzo's own pair, read off the ramps rather than transcribed — no hue is written by hand here. */
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

/**
 * A palette's brand and status colours — DECLARED, never mapped from the base16 accents.
 *
 * daisyUI is the model here, not base16: a theme owns `primary` and the status family, each with an
 * on-fill ink. base16 nominates no primary at all, and its `base08`/`base0A`/`base0B` mean
 * *variables*, *classes* and *strings* — so mapping them onto destructive/warning/success would let
 * a palette say "this succeeded" in whatever hue it happens to use for literals. Every value below
 * comes from the source project's own guidance where it has any, and `provenance` records which.
 *
 * `content` is the ink that sits ON the fill; for the borrowed palettes it is `base00`, which is
 * Catppuccin's own published rule (`On Accent → Base`) and reads correctly for the others too.
 * `foreground` — the readable-on-the-page variant, our existing status contract — is the fill
 * itself for a borrowed palette, and that is not a shortcut: these are syntax palettes, so their
 * accents were chosen to be read AS TEXT on exactly this background. Where that fails,
 * `statusRelief` says so rather than a hex being nudged.
 *
 * A palette declaring `primary` is what makes it replace `data-accent` rather than sit beside it.
 */
const roleVars = (entry) => {
  const { primary, status } = entry;
  return {
    "--primary": primary.fill,
    "--primary-foreground": primary.content,
    "--ring": primary.fill,
    "--sidebar-primary": primary.fill,
    "--sidebar-primary-foreground": primary.content,
    "--sidebar-ring": primary.fill,
    ...Object.fromEntries(
      Object.entries(status).flatMap(([role, r]) => [
        [`--${role}`, r.fill],
        [`--${role}-foreground`, r.foreground ?? r.fill],
        [`--${role}-content`, r.content],
      ]),
    ),
  };
};

/**
 * Slots that do not clear WCAG AA *as text* on their own `base00`.
 *
 * Declared per palette and re-measured by `palettes.test.ts`, the way a scheme's `relief` is: a
 * number nobody can check is a number nobody believes. It reads differently here than it does for a
 * scheme, though — a chart slot is a mark, so 3:1 with a relief channel is a documented relax, but
 * every one of these slots renders as small text, so the bar is 4.5:1 and there is no relief channel
 * to offer. It is a property of the palette, not a defect introduced by mapping it: Nord's comments
 * are 1.7:1 in Nord, and Catppuccin Latte is a low-contrast theme by design. Published so choosing
 * one is an informed choice, and so `kanzo`'s own empty list cannot quietly stop being empty.
 */
const PALETTES = {
  // base00–base05 run background → ink in every entry, which is base16's own ordering for a dark
  // scheme and its documented inversion for a light one.
  kanzo: {
    label: "Kanzo",
    appearance: "light",
    pairsWith: "kanzo-dark",
    // `-500`/`-600` for base03/base04, not `-400`/`-500`: base16 orders the ramp monotonically from
    // background to ink, and taking the shades `tokens.css` used put comments at 2.5:1 on `-50`.
    // A comment is small text, so it owes 4.5:1 like any other.
    relief: [],
    slots: kanzoSlots([50, 100, 200, 500, 600, 800, 900, 950], 700),
  },
  "kanzo-dark": {
    label: "Kanzo Dark",
    appearance: "dark",
    pairsWith: "kanzo",
    // base07 is white outright: the ramp stops at `-50`, which is already base06, and letting
    // `fillSlots` manufacture it would land on that same value.
    // `-400`/`-300`, for the same reason and the same measurement in the other direction: on
    // `-950`, `-500` leaves a comment at 4.2:1.
    relief: [],
    slots: { ...kanzoSlots([950, 900, 800, 400, 300, 100, 50], 400), base07: "#ffffff" },
  },
  // Dracula's published spec names four greys and seven accents, so base0F repeats the red (base16
  // reserves it for "deprecated", which Dracula has no colour for) and base06/07 are manufactured.
  dracula: {
    label: "Dracula",
    appearance: "dark",
    pairsWith: null,
    relief: ["base03"],
    slots: {
      base00: "#282a36", base01: "#363948", base02: "#44475a", base03: "#6272a4",
      base04: "#a3a6be", base05: "#f8f8f2",
      base08: "#ff5555", base09: "#ffb86c", base0A: "#f1fa8c", base0B: "#50fa7b",
      base0C: "#8be9fd", base0D: "#bd93f9", base0E: "#ff79c6", base0F: "#ff5555",
    },
  },
  // Nord ships sixteen numbered colours and a published base16 port; the neutrals are nord0–nord6
  // verbatim. Its accents are the reason `deriveScheme` refuses it — six of seven sit below the
  // chroma floor, so Nord has hues to *look* like and none to chart with.
  nord: {
    label: "Nord",
    appearance: "dark",
    pairsWith: null,
    relief: ["base03", "base08", "base09", "base0E", "base0F"],
    slots: {
      base00: "#2e3440", base01: "#3b4252", base02: "#434c5e", base03: "#4c566a",
      base04: "#d8dee9", base05: "#eceff4", base06: "#e5e9f0", base07: "#8fbcbb",
      base08: "#bf616a", base09: "#d08770", base0A: "#ebcb8b", base0B: "#a3be8c",
      base0C: "#88c0d0", base0D: "#81a1c1", base0E: "#b48ead", base0F: "#5e81ac",
    },
  },
  "catppuccin-latte": {
    label: "Catppuccin Latte",
    appearance: "light",
    pairsWith: "catppuccin-mocha",
    relief: [
      "base03", "base04", "base09", "base0A", "base0B", "base0C", "base0D", "base0F",
    ],
    slots: {
      base00: "#eff1f5", base01: "#e6e9ef", base02: "#ccd0da", base03: "#9ca0b0",
      base04: "#6c6f85", base05: "#4c4f69",
      base08: "#d20f39", base09: "#fe640b", base0A: "#df8e1d", base0B: "#40a02b",
      base0C: "#179299", base0D: "#1e66f5", base0E: "#8839ef", base0F: "#e64553",
    },
  },
  "catppuccin-mocha": {
    label: "Catppuccin Mocha",
    appearance: "dark",
    pairsWith: "catppuccin-latte",
    relief: ["base03"],
    slots: {
      base00: "#1e1e2e", base01: "#313244", base02: "#45475a", base03: "#6c7086",
      base04: "#9399b2", base05: "#cdd6f4",
      base08: "#f38ba8", base09: "#fab387", base0A: "#f9e2af", base0B: "#a6e3a1",
      base0C: "#94e2d5", base0D: "#89b4fa", base0E: "#cba6f7", base0F: "#eba0ac",
    },
  },
};

/** The default palette — at the default the attribute is absent and `tokens.css` `:root` applies. */
const DEFAULT_PALETTE = "kanzo";

/**
 * Brand and status per palette. Kept beside the slots rather than inside them, because these are a
 * different KIND of fact: the slots are the palette's published strip, these are an interpretation.
 *
 * `provenance` records which, per role, and it is a field rather than a comment because the whole
 * argument for declaring these instead of deriving them is that the question "says who?" has an
 * answer. `upstream` — the source project's own guidance. `ecosystem` — a port or consumer
 * convention. `kanzo` — ours, because the source documents no such role.
 *
 * Two findings that shaped this and are worth not re-deriving. **Nord designates its own primary**:
 * `nord.css` says of nord8 "Main color for primary UI elements", so daisyUI's choice of nord10 is
 * simply wrong, and it fails contrast (3.10) besides. And **Dracula designates no brand at all** —
 * "primary" and "brand" appear nowhere in its spec, which is scoped to syntax highlighting — so its
 * pink is an ecosystem convention and is labelled as one.
 */
const kanzoStatus = (fgStep) => ({
  destructive: { fill: hexOf("red-600"), content: "#ffffff", foreground: hexOf(`red-${fgStep}`) },
  info: { fill: hexOf("blue-600"), content: "#ffffff", foreground: hexOf(`blue-${fgStep}`) },
  success: {
    fill: hexOf("emerald-600"),
    content: hexOf("neutral-950"),
    foreground: hexOf(`emerald-${fgStep}`),
  },
  warning: {
    fill: hexOf("amber-600"),
    content: hexOf("neutral-950"),
    foreground: hexOf(`amber-${fgStep}`),
  },
});
/** A borrowed palette's accents were chosen to be read as text on its own ground — so they are. */
const borrowed = (bg, roles) =>
  Object.fromEntries(Object.entries(roles).map(([k, fill]) => [k, { fill, content: bg }]));

const ROLES = {
  kanzo: {
    primary: { fill: hexOf("neutral-800"), content: hexOf("neutral-50") },
    status: kanzoStatus(700),
    provenance: { primary: "kanzo", destructive: "kanzo", info: "kanzo", success: "kanzo", warning: "kanzo" },
    statusRelief: [],
  },
  "kanzo-dark": {
    primary: { fill: hexOf("neutral-100"), content: hexOf("neutral-800") },
    status: kanzoStatus(400),
    provenance: { primary: "kanzo", destructive: "kanzo", info: "kanzo", success: "kanzo", warning: "kanzo" },
    statusRelief: [],
  },
  dracula: {
    primary: { fill: "#ff79c6", content: "#282a36" },
    // Red is Dracula's declared `Error` scope. Green and orange are transitive — the spec has no
    // Success or Warning, only `DiffInserted: (Green)` and `DiffChanged: (Orange)`. Cyan for info
    // has no scope of any kind and is daisyUI's. Orange over daisyUI's yellow deliberately: yellow
    // in the spec means String, and at 12.7 on this ground it reads as a highlighter, not a warning.
    status: borrowed("#282a36", {
      destructive: "#ff5555", info: "#8be9fd", success: "#50fa7b", warning: "#ffb86c",
    }),
    provenance: { primary: "ecosystem", destructive: "upstream", info: "ecosystem", success: "upstream", warning: "upstream" },
    statusRelief: [],
  },
  nord: {
    // Four of five straight from Nord's own docs, which describe UI roles first-class. Only `info`
    // is ours — Nord names no such role — and nord9 is its "secondary UI elements that also require
    // more visual attention", which is the nearest thing it does name.
    primary: { fill: "#88c0d0", content: "#2e3440" },
    status: borrowed("#2e3440", {
      destructive: "#bf616a", info: "#81a1c1", success: "#a3be8c", warning: "#ebcb8b",
    }),
    provenance: { primary: "upstream", destructive: "upstream", info: "kanzo", success: "upstream", warning: "upstream" },
    // nord11 is a mid-tone: 3.05 against its own ground, and even pure black only reaches 5.13.
    // A property of Nord, like its 1.7:1 comments — declared, not nudged.
    statusRelief: ["destructive"],
  },
  "catppuccin-latte": {
    // Mauve is the port default, not the style guide — Catppuccin names no brand role at all.
    // Content is `base00` by Catppuccin's own published rule: the Typography table's `On Accent → Base`.
    primary: { fill: "#8839ef", content: "#eff1f5" },
    status: borrowed("#eff1f5", {
      destructive: "#d20f39", info: "#1e66f5", success: "#40a02b", warning: "#df8e1d",
    }),
    provenance: { primary: "ecosystem", destructive: "upstream", info: "upstream", success: "upstream", warning: "upstream" },
    // Latte is low-contrast by design and its own guide opens with "Legibility always comes first,
    // so please use your own judgement." Three of five roles cannot carry AA in its published
    // values, and inventing darker Catppuccin colours would stop it being Catppuccin.
    statusRelief: ["info", "success", "warning"],
  },
  "catppuccin-mocha": {
    primary: { fill: "#cba6f7", content: "#1e1e2e" },
    status: borrowed("#1e1e2e", {
      destructive: "#f38ba8", info: "#89b4fa", success: "#a6e3a1", warning: "#f9e2af",
    }),
    provenance: { primary: "ecosystem", destructive: "upstream", info: "upstream", success: "upstream", warning: "upstream" },
    statusRelief: [],
  },
};

const paletteVars = (name, entry) => {
  const { slots, extended } = fillSlots(entry.slots, entry.appearance);
  const surfaces = entry.appearance === "light" ? paletteLight(slots) : paletteDark(slots);
  const roles = ROLES[name];
  if (!roles) throw new Error(`palette "${name}" declares no brand or status roles`);
  return {
    slots,
    extended,
    ...roles,
    vars: {
      // Declared, not inferred: a dark palette must render dark with no `.dark` in sight, and this
      // is what tells the browser to darken form controls and scrollbars with it.
      "color-scheme": entry.appearance,
      ...surfaces,
      // After the surfaces, so `--primary`/`--ring` land here rather than wherever `data-accent`
      // last set them. This is the line that makes a palette REPLACE the accent axis instead of
      // sitting beside it — the daisyUI model, and the whole point of the exercise.
      ...roleVars(roles),
      ...Object.fromEntries(
        Object.entries(SYNTAX).map(([role, slot]) => [`--kanzo-syntax-${role}`, slots[slot]]),
      ),
    },
  };
};

const PALETTE_VARS = Object.fromEntries(
  Object.entries(PALETTES).map(([name, entry]) => [name, paletteVars(name, entry)]),
);

// ── Fonts — the DS ships NO font files. `data-font`/`data-mono-font` point --font-sans/
//    --font-mono at a stack; `var(--font-*)` keys let a host inject its own webfont var
//    (e.g. next/font sets --font-geist-sans) with a graceful system fallback. ──
const SYSTEM_SANS = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const SYSTEM_MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';
const FONTS = [
  ["system", SYSTEM_SANS],
  ["geist", `var(--font-geist-sans, ${SYSTEM_SANS})`],
  ["inter", `var(--font-inter, ${SYSTEM_SANS})`],
];
const MONO_FONTS = [
  ["system", SYSTEM_MONO],
  ["geist-mono", `var(--font-geist-mono, ${SYSTEM_MONO})`],
  ["jetbrains-mono", `var(--font-jetbrains-mono, ${SYSTEM_MONO})`],
];

// ── Density (matches keasy's data-font-size → root font-size rem-scale). `default`
//    = attribute absent (16px). ──
const DENSITIES = [["compact", "14px"], ["comfortable", "18px"]];

// ── Emit ─────────────────────────────────────────────────────────────────────
const block = (sel, vars) =>
  `${sel} {\n${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n}\n`;

let out = `/* GENERATED by scripts/gen-theme.mjs from Shark UI's exact theme data. Do not edit by hand. */\n\n`;

// Custom colour scales (Tailwind built-ins cover slate/gray/zinc/neutral/stone).
out += ":root {\n";
for (const [name, shades] of Object.entries(CUSTOM_SCALES))
  for (const [shade, hex] of Object.entries(shades)) out += `  --color-${name}-${shade}: ${hex};\n`;
out += "}\n\n";

out += "/* ── Base colour scale (data-base) ──────────────────────────────────────── */\n";
for (const c of BASES) {
  out += block(`[data-base="${c}"]`, baseLight(c));
  out += block(`.dark[data-base="${c}"], .dark [data-base="${c}"]`, baseDark(c));
}

out += "\n/* ── Accent / primary (data-accent) ─────────────────────────────────────── */\n";
for (const [a, lp, lr, lpf, dp, dr, dpf] of ACCENTS) {
  out += block(`[data-accent="${a}"]`, accentVars(a, lp, lr, lpf));
  out += block(`.dark[data-accent="${a}"], .dark [data-accent="${a}"]`, accentVars(a, dp, dr, dpf));
}

out += "\n/* ── Categorical scheme (data-chart-scheme) ─────────────────────────────── */\n";
// `data-chart-scheme`, not `data-scheme`, which would read as CSS `color-scheme` — and `.dark`
// lives on the same element, so that ambiguity would be paid for daily.
for (const [name, { light, dark }] of Object.entries(SCHEMES)) {
  out += block(`[data-chart-scheme="${name}"]`, schemeVars(light));
  out += block(`.dark[data-chart-scheme="${name}"], .dark [data-chart-scheme="${name}"]`, schemeVars(dark));
}

out += "\n/* ── Palette (data-palette) ─────────────────────────────────────────────── */\n";
// The selector is doubled on purpose. A palette carries its own appearance, so its block must not
// be scoped under `.dark` — but that puts it at (0,1,0) against the base scale's dark rules at
// (0,2,0), and `.dark [data-base]` would then win over the palette a user explicitly chose.
// Repeating the attribute matches specificity, and emitting after the base/accent blocks settles
// the tie in the palette's favour, which is the intended precedence: a palette replaces a base.
for (const [name, { vars }] of Object.entries(PALETTE_VARS)) {
  out += block(`[data-palette="${name}"][data-palette="${name}"]`, vars);
}

out += "\n/* ── Radius (data-radius) ───────────────────────────────────────────────── */\n";
for (const [r, val] of RADII) out += block(`[data-radius="${r}"]`, { "--radius": val });

out += "\n/* ── Fonts (data-font / data-mono-font) ─────────────────────────────────── */\n";
for (const [f, stack] of FONTS) out += block(`[data-font="${f}"]`, { "--font-sans": stack });
for (const [f, stack] of MONO_FONTS) out += block(`[data-mono-font="${f}"]`, { "--font-mono": stack });

out += "\n/* ── Density (data-font-size → root font-size rem-scale) ────────────────── */\n";
for (const [d, size] of DENSITIES) out += block(`[data-font-size="${d}"]`, { "font-size": size });

writeFileSync(OUT, out);

// ── Also emit theme-data.json — the same exact data as a runtime module, so the
//    Preferences "Copy theme" can assemble Shark's :root/.dark export string. ──
// The same status objects the palette blocks emit — one copy, so a "Copy theme CSS" export and a
// selected palette cannot disagree about what `--warning-content` is.
// `--chart-*` used to live here, which is exactly why it was never right: static meant no axis
// owned it, so `base` and `accent` never reached it and nobody ever chose it. It is a scheme now.
const STATIC_LIGHT = STATUS_LIGHT;
// Dark `--destructive(-foreground)` come from the base object; the rest are static.
const STATIC_DARK = STATUS_DARK;
const data = {
  bases: Object.fromEntries(BASES.map((c) => [c, { light: baseLight(c), dark: baseDark(c) }])),
  accents: Object.fromEntries(
    ACCENTS.map(([a, lp, lr, lpf, dp, dr, dpf]) => [a, { light: accentVars(a, lp, lr, lpf), dark: accentVars(a, dp, dr, dpf) }]),
  ),
  radii: Object.fromEntries(RADII.map(([r, v]) => [r, v])),
  fonts: Object.fromEntries(FONTS.map(([f, v]) => [f, v])),
  monoFonts: Object.fromEntries(MONO_FONTS.map(([f, v]) => [f, v])),
  densities: Object.fromEntries([["default", "16px"], ...DENSITIES]),
  curatedAccents: CURATED_ACCENTS,
  // name → the colour a picker should show for it. Both tables exist so no panel has to keep its
  // own copy of what a named axis value looks like.
  // The chromatic families as hex, so a derivation can run in plain JS. Tailwind publishes them as
  // `oklch()`, which nothing downstream parses, and only in a CSS file — which is why every table
  // that needed these values used to be transcribed by hand and then rot.
  ramps: Object.fromEntries(
    CHROMATIC.map((hue) => [hue, Object.fromEntries(RAMP_STEPS.map((s) => [s, hexOf(`${hue}-${s}`)]))]),
  ),
  accentSwatches: Object.fromEntries(CURATED_ACCENTS.map((a) => [a, accentSwatch(a)])),
  baseSwatches: Object.fromEntries(
    BASES.filter((b) => b !== "custom").map((b) => [b, baseSwatch(b)]),
  ),
  // The scheme values as data, which is the point: `packages/ui` imports these rather than
  // carrying its own copy, so a chart still has colours with no theme CSS loaded and there is
  // still only one place they are written down.
  schemes: Object.fromEntries(
    Object.entries(SCHEMES).map(([name, s]) => [
      name,
      // `slots` is the scheme's *capacity* — how many real categories it can name. The arrays stay
      // eight long so the CSS and the compiled export line up with the token count; a panel or a
      // doc reads `slots` to say "this scheme carries six series", and a seventh folds to Other.
      { ...s, slots: s.light.length, light: pad(s.light), dark: pad(s.dark) },
    ]),
  ),
  defaultScheme: "kanzo",
  // The palettes as data: the sixteen slots (so a panel can show the strip a base16 palette *is*),
  // which of them this file had to manufacture, and the tokens the CSS above sets from them.
  palettes: Object.fromEntries(
    Object.entries(PALETTES).map(([name, entry]) => [
      name,
      {
        label: entry.label,
        appearance: entry.appearance,
        // The partner palette of the same identity, or null. Pairing is what replaces the light/dark
        // toggle: the OS preference selects the partner rather than inverting a mode, and a palette
        // with no partner (Dracula) simply pins the appearance, which is the honest answer for a
        // palette that has no light side and should not have one invented.
        pairsWith: entry.pairsWith,
        relief: entry.relief,
        ...PALETTE_VARS[name],
      },
    ]),
  ),
  defaultPalette: DEFAULT_PALETTE,
  syntaxRoles: SYNTAX,
  // The status fill/ink pairs RESOLVED to hex, per mode.
  //
  // The CSS keeps `var(--color-red-600)` because that is what makes it themeable, but a `var()`
  // reference cannot be measured — which is precisely how `text-white` sat at 2.13:1 on the warning
  // fill without anything noticing. These are the same values, resolved once here so
  // `palettes.test.ts` can put a number on them.
  statusInk: Object.fromEntries(
    ["light", "dark"].map((mode) => {
      const src = mode === "light" ? STATUS_LIGHT : STATUS_DARK;
      const ref = (v) => {
        const m = /var\(--color-([a-z]+)(?:-(\d+))?\)/.exec(v ?? "");
        if (!m) return null;
        return m[1] === "white" ? "#ffffff" : hexOf(`${m[1]}-${m[2]}`);
      };
      return [
        mode,
        Object.fromEntries(
          ["destructive", "info", "success", "warning"].map((role) => [
            role,
            {
              // Dark `--destructive` is a base-derived mix, so it has no single named step; the
              // measurement uses red-600, which is what that mix is 90% of.
              fill: ref(src[`--${role}`]) ?? hexOf("red-600"),
              content: ref(src[`--${role}-content`]),
            },
          ]),
        ),
      ];
    }),
  ),
  staticLight: STATIC_LIGHT,
  staticDark: STATIC_DARK,
};
const JSON_OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "theme-data.json");
writeFileSync(JSON_OUT, JSON.stringify(data, null, 2));

console.log(
  `Wrote ${OUT} + theme-data.json — ${BASES.length} bases, ${ACCENTS.length} accents, ${Object.keys(PALETTES).length} palettes, ${Object.keys(SCHEMES).length} scheme(s), ${RADII.length} radii, ${FONTS.length} fonts, ${MONO_FONTS.length} mono, ${DENSITIES.length + 1} densities.`,
);
