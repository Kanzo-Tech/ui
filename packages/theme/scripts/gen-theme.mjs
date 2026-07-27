/*
 * gen-theme.mjs — emits `packages/theme/themes.css` from Shark UI's exact theme data
 * (its `/themes` GRAY_COLORS / PRIMARY_COLORS / BORDER_RADIUS, verbatim colour/radius math).
 *
 * MECHANISM (canonical, matches keasy + tweakcn): theming is driven by `data-*` attributes
 * on <html> (NOT classes). `data-base` sets the neutral scale, `data-accent` overrides the 6
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
const schemeVars = (colours) => Object.fromEntries(colours.map((hex, i) => [`--chart-${i + 1}`, hex]));

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
const STATIC_LIGHT = {
  "--destructive": "var(--color-red-500)",
  "--destructive-foreground": "var(--color-red-700)",
  "--info": "var(--color-blue-500)",
  "--info-foreground": "var(--color-blue-700)",
  "--success": "var(--color-emerald-500)",
  "--success-foreground": "var(--color-emerald-700)",
  "--warning": "var(--color-amber-500)",
  "--warning-foreground": "var(--color-amber-700)",
  // `--chart-*` used to live here, which is exactly why it was never right: static meant no axis
  // owned it, so `base` and `accent` never reached it and nobody ever chose it. It is a scheme now.
};
const STATIC_DARK = {
  // dark --destructive(-foreground) come from the base object; the rest are static.
  "--info": "var(--color-blue-500)",
  "--info-foreground": "var(--color-blue-400)",
  "--success": "var(--color-emerald-500)",
  "--success-foreground": "var(--color-emerald-400)",
  "--warning": "var(--color-amber-500)",
  "--warning-foreground": "var(--color-amber-400)",
};
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
  accentSwatches: Object.fromEntries(CURATED_ACCENTS.map((a) => [a, accentSwatch(a)])),
  baseSwatches: Object.fromEntries(
    BASES.filter((b) => b !== "custom").map((b) => [b, baseSwatch(b)]),
  ),
  // The scheme values as data, which is the point: `packages/ui` imports these rather than
  // carrying its own copy, so a chart still has colours with no theme CSS loaded and there is
  // still only one place they are written down.
  schemes: SCHEMES,
  defaultScheme: "kanzo",
  staticLight: STATIC_LIGHT,
  staticDark: STATIC_DARK,
};
const JSON_OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "theme-data.json");
writeFileSync(JSON_OUT, JSON.stringify(data, null, 2));

console.log(
  `Wrote ${OUT} + theme-data.json — ${BASES.length} bases, ${ACCENTS.length} accents, ${Object.keys(SCHEMES).length} scheme(s), ${RADII.length} radii, ${FONTS.length} fonts, ${MONO_FONTS.length} mono, ${DENSITIES.length + 1} densities.`,
);
