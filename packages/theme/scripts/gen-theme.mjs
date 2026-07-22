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
import { writeFileSync } from "node:fs";
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
  "--chart-1": "var(--color-orange-600)",
  "--chart-2": "var(--color-teal-600)",
  "--chart-3": "var(--color-cyan-900)",
  "--chart-4": "var(--color-amber-400)",
  "--chart-5": "var(--color-amber-500)",
};
const STATIC_DARK = {
  // dark --destructive(-foreground) come from the base object; the rest are static.
  "--info": "var(--color-blue-500)",
  "--info-foreground": "var(--color-blue-400)",
  "--success": "var(--color-emerald-500)",
  "--success-foreground": "var(--color-emerald-400)",
  "--warning": "var(--color-amber-500)",
  "--warning-foreground": "var(--color-amber-400)",
  "--chart-1": "var(--color-blue-700)",
  "--chart-2": "var(--color-emerald-500)",
  "--chart-3": "var(--color-amber-500)",
  "--chart-4": "var(--color-purple-500)",
  "--chart-5": "var(--color-rose-500)",
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
  staticLight: STATIC_LIGHT,
  staticDark: STATIC_DARK,
};
const JSON_OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "theme-data.json");
writeFileSync(JSON_OUT, JSON.stringify(data, null, 2));

console.log(
  `Wrote ${OUT} + theme-data.json — ${BASES.length} bases, ${ACCENTS.length} accents, ${RADII.length} radii, ${FONTS.length} fonts, ${MONO_FONTS.length} mono, ${DENSITIES.length + 1} densities.`,
);
