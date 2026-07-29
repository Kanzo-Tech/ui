import themeDataJson from "../theme-data.json";

/**
 * The generated theme tables — the four non-colour axes — as a JS module.
 *
 * Consumers must read them through this export rather than importing
 * `@kanzo-tech/theme/theme-data.json` directly. A raw JSON subpath import is an ESM JSON
 * import at runtime, which Node rejects without `with { type: "json" }` — and Rollup strips
 * that attribute when bundling, so there is no way to make the direct import survive a build.
 * Bundling the data into this package's own JS entry is safe: it is the package that owns the
 * data, so the copy can never skew from the CSS generated alongside it.
 *
 * The tables a *derivation* reads are not here. They are inputs to colour maths that runs once at
 * onboarding, and they live with it, in `@kanzo-tech/palette`.
 */
export const themeData = themeDataJson;
export type ThemeData = typeof themeDataJson;

/**
 * How many `--chart-*` custom properties the stylesheet declares. A 9th series folds into "Other" —
 * never cycle, or identity stops meaning anything.
 *
 * A fact about the SHEET, which is why it is here and not with the derivation that emits it: a
 * chart resolving `var(--chart-N)` off the cascade needs the count, and a chart runs in a browser
 * where `@kanzo-tech/palette` deliberately cannot be reached. The count is a compile-time constant
 * because a stylesheet cannot have a variable number of custom properties.
 *
 * How many of the slots carry a *real* category is the document's `capacity`, which can be lower;
 * it travels down the cascade as `--chart-capacity`, and past it `compile()` writes
 * `var(--muted-foreground)`.
 *
 * `packages/palette` declares the same number, because it is what emits the properties. Neither
 * copy is trusted: `boundary.test.ts` counts the declarations in the shipped `tokens.css` and
 * holds both against it.
 */
export const CHART_SLOTS = 8;

/**
 * `@kanzo-tech/theme` — design tokens, the theme axis table, and the value types. No React.
 *
 * **Colour is not an axis.** A tenant's identity is a palette DOCUMENT — two seeds derived and
 * measured once at onboarding, stored as data, compiled to one stylesheet the server inlines. The
 * default tenant is not a special case: `palettes/kanzo.json` is a tenant whose document happens to
 * be committed, and `tokens.css`'s colour half is that document compiled.
 *
 * What is still driven by `data-*` attributes on `<html>` is everything that is not colour, whose
 * values live in `themes.css`:
 * · `data-radius`     — sets `--radius`.
 * · `data-font`       — sets `--font-sans`.
 * · `data-mono-font`  — sets `--font-mono`.
 * · `data-font-size`  — sets the root font-size (the rem density scale).
 *
 * Writing those attributes is `<KanzoThemeProvider>`'s job, from `@kanzo-tech/ui`. It sets them
 * on `document.documentElement` — see the AXES note below for why a wrapper element cannot work.
 *
 * Dark mode is not owned here: the host toggles `.dark` on `<html>` (next-themes or the
 * provider's built-in fallback), and the `.dark` block of the compiled document keys off it.
 *
 * Requires `@kanzo-tech/ui/styles.css` (or the raw token/theme CSS) imported once at the root.
 */

/** Appearance PREFERENCE — light, dark, or `system` (follow the OS). */
export type Appearance = "light" | "dark" | "system";

/** The APPLIED appearance, after `system` is resolved against the OS. */
export type ResolvedAppearance = "light" | "dark";

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

/**
 * The user's preferences. Five, and none of them is a colour.
 *
 * Colour left this table entirely: it is client identity, not user preference. `palette`, `base`,
 * `accent`, `primary`, `baseTint`, `scheme` and `schemeColors` were seven ways to express *part* of
 * a palette at runtime, and a document expresses all of it at once, before a byte is sent.
 * `appearance` stays because it is the one colour-adjacent thing a user genuinely chooses, and it
 * selects between two blocks of one document rather than between two identities.
 */
export interface ThemePrefs {
  appearance: Appearance;
  radius: KanzoRadius;
  font: KanzoFont;
  monoFont: KanzoMonoFont;
  density: KanzoDensity;
}

export const DEFAULT_PREFS: ThemePrefs = {
  appearance: "system",
  radius: "md",
  font: "system",
  monoFont: "system",
  density: "default",
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
 *
 * `appearance` is not here and never was: it writes a class, not an attribute.
 */
export const AXES: { key: keyof ThemePrefs; attr: string; def: string }[] = [
  { key: "radius", attr: "data-radius", def: "md" },
  { key: "font", attr: "data-font", def: "system" },
  { key: "monoFont", attr: "data-mono-font", def: "system" },
  { key: "density", attr: "data-font-size", def: "default" },
];
