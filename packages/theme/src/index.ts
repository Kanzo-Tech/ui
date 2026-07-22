import themeDataJson from "../theme-data.json";

/**
 * The generated theme tables (bases, accents, radii, fonts, densities…) as a JS module.
 *
 * Consumers must read them through this export rather than importing
 * `@kanzo-tech/theme/theme-data.json` directly. A raw JSON subpath import is an ESM JSON
 * import at runtime, which Node rejects without `with { type: "json" }` — and Rollup strips
 * that attribute when bundling, so there is no way to make the direct import survive a build.
 * Bundling the data into this package's own JS entry is safe: it is the package that owns the
 * data, so the copy can never skew from the CSS generated alongside it.
 */
export const themeData = themeDataJson;
export type ThemeData = typeof themeDataJson;

/**
 * `@kanzo-tech/theme` — design tokens, the theme axis table, and the value types. No React.
 *
 * Theming is driven by `data-*` attributes on `<html>`, whose token values live in
 * `themes.css` (generated from Shark's exact colour/radius data):
 * · `data-base`       — the neutral scale (background/card/muted/border/…).
 * · `data-accent`     — overrides only the 6 primary/ring tokens.
 * · `data-radius`     — sets `--radius`.
 * · `data-font`       — sets `--font-sans`.
 * · `data-mono-font`  — sets `--font-mono`.
 * · `data-font-size`  — sets the root font-size (the rem density scale).
 *
 * Writing those attributes is `<KanzoThemeProvider>`'s job, from `@kanzo-tech/ui`. It sets them
 * on `document.documentElement` — see the AXES note below for why a wrapper element cannot work.
 *
 * Dark mode is not owned here: the host toggles `.dark` on `<html>` (next-themes or the
 * provider's built-in fallback) and the generated dark rules key off that ancestor.
 *
 * Requires `@kanzo-tech/ui/styles.css` (or the raw token/theme CSS) imported once at the root.
 */

/** Light/dark, as reported and set by the host's appearance controller. */
export type Appearance = "light" | "dark";

/** Base neutral scale — the full set (surfaced only in the playground theme-editor). */
export type KanzoBase =
  | "slate" | "gray" | "zinc" | "neutral" | "stone" | "mauve" | "olive" | "mist" | "taupe";

/** Accent hues — the full set: `neutral` + the 17 Tailwind hues (playground editor). */
export type KanzoAccent =
  | "neutral" | "red" | "orange" | "amber" | "yellow" | "lime" | "green" | "emerald"
  | "teal" | "cyan" | "sky" | "blue" | "indigo" | "violet" | "purple" | "fuchsia" | "pink" | "rose";

/** Curated accent subset surfaced in the product Preferences panel (keasy's names). */
export type CuratedAccent = "neutral" | "blue" | "green" | "violet" | "orange" | "rose";

/** Radius steps (`md` = 0.5rem default). */
export type KanzoRadius = "none" | "xs" | "sm" | "md" | "lg";

/** Density (root font-size rem-scale); `default` omits the attribute. */
export type KanzoDensity = "default" | "compact" | "comfortable";

/** Sans font key — host-extensible; the DS ships `system`/`geist`/`inter` stacks. */
export type KanzoFont = "system" | "geist" | "inter" | (string & {});

/** Mono font key — host-extensible; the DS ships `system`/`geist-mono`/`jetbrains-mono`. */
export type KanzoMonoFont = "system" | "geist-mono" | "jetbrains-mono" | (string & {});

// ── The axis table — the single source of truth for how a preference reaches the DOM ────────
//
// This lives here, not in @kanzo-tech/ui, because three separate things must agree on it and
// two of them are in different packages: the React provider, the SSR pre-hydration script, and
// `scripts/gen-theme.mjs`, which decides which selectors exist in themes.css at all. When they
// drifted there was no type error to catch it — miss the generator and the provider writes an
// attribute no CSS matches; miss the script and the FOUC it exists to prevent comes back.

export interface ThemePrefs {
  /** Any of the full accent set; the product panel offers the curated subset. */
  accent: KanzoAccent;
  radius: KanzoRadius;
  font: KanzoFont;
  monoFont: KanzoMonoFont;
  density: KanzoDensity;
  /** Supported but not surfaced by the default panel — default neutral. */
  base?: KanzoBase;
  /** Custom primary colour (any CSS colour). When set it overrides the `accent` preset by
   *  writing `--primary`/`--ring`/`--sidebar-primary(-ring)` inline; foreground is derived. */
  primary?: string;
  /** Custom base TINT (any CSS colour). When set it generates a neutral ramp tinted toward this
   *  hue (`--color-custom-*` + `data-base="custom"`), overriding the named `base`. */
  baseTint?: string;
}

export const DEFAULT_PREFS: ThemePrefs = {
  accent: "neutral",
  radius: "md",
  font: "system",
  monoFont: "system",
  density: "default",
  base: "neutral",
};

export const STORAGE_KEY = "kanzo_theme_prefs";
export const APPEARANCE_KEY = "kanzo_appearance";

/**
 * Each axis → its `<html>` attribute + default value (at the default the attribute is removed).
 *
 * These attributes go on `<html>`, never a wrapper element. Ark overlays (Dialog, Popover,
 * Menu, Select, Tooltip, Toast…) portal to `document.body`, outside any wrapper, so tokens set
 * on a wrapper would not reach them. `density` additionally *must* be on the root: it sets the
 * root font-size and every size in the system is `rem`.
 */
export const AXES: { key: keyof ThemePrefs; attr: string; def: string }[] = [
  { key: "base", attr: "data-base", def: "neutral" },
  { key: "accent", attr: "data-accent", def: "neutral" },
  { key: "radius", attr: "data-radius", def: "md" },
  { key: "font", attr: "data-font", def: "system" },
  { key: "monoFont", attr: "data-mono-font", def: "system" },
  { key: "density", attr: "data-font-size", def: "default" },
];

export const PRIMARY_OVERRIDE = ["--primary", "--ring", "--sidebar-primary", "--sidebar-ring"];
export const PRIMARY_FG_OVERRIDE = ["--primary-foreground", "--sidebar-primary-foreground"];
