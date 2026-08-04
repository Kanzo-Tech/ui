import paletteIndexJson from "../palettes/index.json";
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
 * The palettes this package ships, as data a picker can render.
 *
 * daisyUI keeps two registries — `themeOrder` (the ordered names) and `theme/object` (name → the
 * variable map) — precisely so a switcher can draw a theme without parsing its CSS. This is both,
 * collapsed: an entry carries what a control needs to *offer* a palette and nothing a page needs to
 * *paint* one, which is the compiled stylesheet's job.
 *
 * A tenant publishing several palettes is the general case and Kanzo is the degenerate one. What is
 * shipped here is five documents: Kanzo's, which `tokens.css` already is, and four borrowed
 * identities compiled with `elevate` — imported by nothing, so they cost nothing until a host asks.
 *
 * Read through this export rather than importing `@kanzo-tech/theme/palettes/index.json`, for the
 * reason given on {@link themeData}: a raw JSON subpath import is an ESM JSON import at runtime, and
 * Rollup strips the attribute that would make it legal.
 */
export const paletteIndex = paletteIndexJson as PaletteIndexEntry[];

/**
 * One palette, as a control sees it.
 *
 * `swatches` is `Record<Appearance, string[]>`, the same shape {@link SwatchOption} uses — the two
 * registries are one vocabulary, which only became true when `Appearance` stopped carrying a third
 * value that no set of colours could ever have.
 */
export interface PaletteIndexEntry {
  id: string;
  label: string;
  /** The one `tokens.css` already carries; it has no stylesheet of its own to load. */
  isDefault: boolean;
  seeds: { brand: string; base: string };
  swatches: Record<Appearance, string[]>;
  capacity: number;
  /** The brands inside this document, **default first**. One entry means there is no choice here. */
  identities: { id: string; label: string; swatches: Record<Appearance, string[]> }[];
}

/**
 * How many `--chart-N` custom properties the stylesheet declares. A 9th series folds into "Other" —
 * never cycle, or identity stops meaning anything. (`--chart-capacity` is declared beside them and
 * is not one of them; `boundary.test.ts` counts `--chart-N` only.)
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
 * What is driven by `data-*` attributes on `<html>` is everything that is not colour, whose values
 * live in `themes.css`:
 * · `data-radius`     — sets `--radius`.
 * · `data-font`       — sets `--font-sans`.
 * · `data-mono-font`  — sets `--font-mono`.
 * · `data-font-size`  — sets the root font-size (the rem density scale).
 *
 * …plus one that IS colour, and is the exception that proves the sentence above:
 * · `data-identity`   — selects among the identities the TENANT published.
 *
 * A tenant may publish more than one brand (a bank's retail blue and its private gold). Each is a
 * brand seed inside the one document; the base, the status ramps and the syntax roles are shared,
 * which is what keeps several identities one product. `compile()` emits `:root`/`.dark` for the
 * default identity and a `[data-identity="X"]` block per additional one, carrying only the
 * brand-derived tokens.
 *
 * **This is `data-palette` in mechanism and not in authority, and that is worth saying out loud
 * rather than leaving someone to find it as a contradiction.** `data-palette` selected from a
 * catalogue of six themes the LIBRARY shipped, so an end user picking Dracula could overrule a
 * client's branding. `data-identity` selects among values the client authored and published. The
 * attribute was never the thing that was wrong.
 *
 * Writing those attributes is `<KanzoThemeProvider>`'s job, from `@kanzo-tech/ui`. It sets them
 * on `document.documentElement` — see the AXES note below for why a wrapper element cannot work.
 *
 * Dark mode is not owned here: the host toggles `.dark` on `<html>` (next-themes or the
 * provider's built-in fallback), and the `.dark` block of the compiled document keys off it.
 *
 * Requires `@kanzo-tech/ui/styles.css` (or the raw token/theme CSS) imported once at the root.
 */

/**
 * A side of the compiled document. `compile()` always emits both blocks, so there are exactly two.
 *
 * **There is no `"system"`, and its absence is the design.** Following the OS is a real behaviour we
 * keep — without it the first visit has to guess, and guessing wrong flashes white at every
 * dark-mode user — but it is the state with *no* value, not a third value.
 *
 * That split is the reference systems', and they divide on which layer they are. The JS
 * theme-switching libraries make it a value: next-themes ships `defaultTheme = "system"` and appends
 * `"system"` to its `themes` array, MUI has `mode: "light" | "dark" | "system"`, Mantine `"auto"`.
 * The *token* layers do not: daisyUI writes `themes: light --default, dark --prefersdark`, where the
 * OS preference is a flag on a theme and `data-theme` overrides it; Tailwind has a media query or a
 * class; Radix Themes declines to model it and delegates to next-themes. And CSS itself has no third
 * keyword — `color-scheme: light dark` means "the OS decides", and an explicit side overrides.
 *
 * We are a token layer: a document with a `:root` block and a `.dark` block. `"system"` arrived here
 * as next-themes vocabulary for a mechanism we do not use, and `themeScript` never believed in it —
 * it has always resolved "anything that is not an explicit side" against `matchMedia`.
 *
 * A host next-themes IS still supported; `KanzoThemeProvider` translates its `"system"` to `null` in
 * one place, the way every other foreign vocabulary enters this system.
 */
export type Appearance = "light" | "dark";

/**
 * The appearance PREFERENCE — an explicit side, or `null` for "ask the OS".
 *
 * `null` and not an absent key: `PREF_KEYS` is `Object.keys(DEFAULT_PREFS)` and the read-time
 * whitelist is built from it, so a key missing from the default blob is dropped on every read.
 * It also survives `JSON.stringify` into both storage adapters, which an `undefined` would not.
 */
export type AppearancePref = Appearance | null;

/** Radius steps (`md` = 0.5rem default). */
export type KanzoRadius = "none" | "xs" | "sm" | "md" | "lg";

/** Density (root font-size rem-scale); `default` omits the attribute. */
export type KanzoDensity = "default" | "compact" | "comfortable";

/** Sans font key — host-extensible; the DS ships `system`/`geist`/`inter` stacks. */
export type KanzoFont = "system" | "geist" | "inter" | (string & {});

/** Mono font key — host-extensible; the DS ships `system`/`geist-mono`/`jetbrains-mono`. */
export type KanzoMonoFont = "system" | "geist-mono" | "jetbrains-mono" | (string & {});

/**
 * Identity key — host-extensible; the DS ships none, and `""` is the tenant's default identity.
 *
 * This is `KanzoFont`'s case, not `KanzoRadius`': a value is a *host's* string, unknown when this
 * package is built. Where `KanzoFont` still names the three stacks the DS happens to ship,
 * there is nothing to union here — every identity is authored by a client, so a literal union
 * would be a list of zero.
 */
export type KanzoIdentity = string;

/**
 * Palette key — which of the documents the TENANT publishes is applied. `""` is their default.
 *
 * **The name is deliberately taken back from the retired list**, where it sat beside `accent`,
 * `base`, `baseTint`, `primary`, `scheme` and `schemeColors`. Those are retired because each was a
 * way to author *part* of a palette at runtime, and a document expresses all of it at once. This one
 * is not that: it names a whole document a tenant published and measured, which is the same kind of
 * choice `identity` makes one level down. It is also the word the domain uses, and inventing a
 * synonym to avoid a name we ourselves freed would be the defect this layer keeps removing.
 *
 * It is **not** an `AXES` row. A palette writes no attribute — a document is a stylesheet, and which
 * one to serve is a decision the SERVER takes from the cookie, before the first byte. `appearance`
 * is not in that table either, for the mirror-image reason: it writes a class.
 */
export type KanzoPalette = string;

/**
 * Which identity this user last chose **in each palette**, so switching away and back returns them
 * to their own brand instead of the document's default.
 *
 * A memory, not an axis, and the distinction is what keeps the two sides in agreement. `identity`
 * stays a plain string that both the provider and the pre-hydration script write verbatim from the
 * axis table; this map is consulted only when the palette *changes*, which is a moment the script
 * never sees — it reads one stored blob and that blob is already consistent. Put the map on the axis
 * instead and the script would have to index it, resolve which palette is applied, and agree with
 * React about the answer before React had rendered.
 *
 * Keyed by the palette PREFERENCE, `""` included: the default palette is stored as the empty string
 * everywhere else, and a second spelling for it here would be a second thing to keep in step.
 */
export type KanzoIdentityMemory = Record<KanzoPalette, KanzoIdentity>;

/**
 * One published colour choice, as the runtime sees it — the contract between a compiled document
 * and the panel. Used by BOTH axes a tenant publishes: `identities` and `palettes`.
 *
 * One type and not two, though it arrived as `IdentityOption`: a palette option and an identity
 * option are the same thing at different grain — an id, a name a client wrote, and a depiction — and
 * two names for one shape is the defect this layer keeps removing. What differs between the axes is
 * what selecting one *does*, not what a control needs to offer it.
 *
 * Declared here rather than imported, the way `CHART_SLOTS` is declared in both packages: the
 * document's own `Identity` carries `brand`, `ramp`, `categorical` and `record`, none of which a
 * browser has any use for, and `boundary.test.ts` keeps `@kanzo-tech/palette` out of the runtime
 * graph with a TEXT match — so even `import type` fails, and rightly. A host maps its document to
 * this shape once, on the server.
 *
 * `value` / `label` because that is `FontOption`: identity is the host-extensible axis. `swatches`
 * is where `FontOption` has `preview` — the depiction, per mode, because the panel draws
 * `swatches[resolvedAppearance]` and the two modes are different colours.
 */
export interface SwatchOption {
  value: string;
  label: string;
  swatches: Record<Appearance, string[]>;
  /**
   * The choices *inside* this one — a palette's brands. **Default first.**
   *
   * A palette and an identity turned out to be one abstraction with a parameter: how much of the
   * document the choice replaces. An identity replaces the brand-derived slice and inherits every
   * surface; a palette replaces all of it. They already shared this type, the same control, the same
   * hide-below-two rule and the same retirement machinery — and the giveaway was the behaviour:
   * changing palette *files and restores* the identity, which is what containment does and what two
   * sibling axes never would.
   *
   * So the containment lives here, in the data, rather than in two parallel props that a caller had
   * to keep consistent. The panel flattens it into one list of composed entries, because one choice
   * is what a user makes.
   */
  children?: SwatchOption[];
}

// ── The axis table — the single source of truth for how a preference reaches the DOM ────────
//
// This lives here, not in @kanzo-tech/ui, because three separate things must agree on it and they
// are split across two packages: the React provider and the SSR pre-hydration script, both in
// `@kanzo-tech/ui`, and `scripts/gen-theme.mjs` here, which decides which selectors exist in
// themes.css at all. Only this package holds all three in view. When they drifted there was no type
// error to catch it — miss the generator and the provider writes an attribute no CSS matches; miss
// the script and the FOUC it exists to prevent comes back.

/**
 * The user's preferences. Six, and only one of them is a colour.
 *
 * *Free* colour left this table entirely: `palette`, `base`, `accent`, `primary`, `baseTint`,
 * `scheme` and `schemeColors` were seven ways to express *part* of a palette at runtime, and a
 * document expresses all of it at once, before a byte is sent. `appearance` stays because it is
 * the one colour-adjacent thing a user genuinely chooses, and it selects between two blocks of one
 * document. `identity` is the same kind of choice one level up: between blocks the TENANT
 * published, and never between a value they did not.
 */
export interface ThemePrefs {
  appearance: AppearancePref;
  radius: KanzoRadius;
  font: KanzoFont;
  monoFont: KanzoMonoFont;
  density: KanzoDensity;
  identity: KanzoIdentity;
  palette: KanzoPalette;
  identityByPalette: Record<KanzoPalette, KanzoIdentity>;
}

/**
 * Every key of `ThemePrefs`, with no exception for the ones whose default is empty.
 *
 * `PREF_KEYS` in the provider is `Object.keys(DEFAULT_PREFS)`, and the read-time whitelist built
 * from it drops anything not listed. A pref missing here therefore works for exactly one session
 * and is gone on the next read, silently and with no type error — the retired-key hygiene rule
 * turned on a live field.
 */
export const DEFAULT_PREFS: ThemePrefs = {
  // `null`, not `"system"`: the default is to have no side pinned, which is the same default the two
  // sentinels beside it use — `identity: ""` defers to the document, this defers to the OS.
  appearance: null,
  radius: "md",
  font: "system",
  monoFont: "system",
  density: "default",
  identity: "",
  // `""` defers to the document the tenant made default, the way `identity` defers to the identity
  // `:root` carries. A tenant publishing one palette therefore stores nothing and serves what it
  // always served.
  palette: "",
  // A fresh browser remembers nothing, and an empty map is not a special case anywhere: every read
  // is `memory[id] ?? ""`, which is the same answer as "this palette's default identity".
  identityByPalette: {},
};

export const STORAGE_KEY = "kanzo_theme_prefs";

/**
 * Each axis → its `<html>` attribute + default value (at the default the attribute is removed).
 *
 * These attributes go on `<html>`, never a wrapper element. Ark overlays (Dialog, Popover,
 * Menu, Select, Tooltip, Toast…) portal to `document.body`, outside any wrapper, so tokens set
 * on a wrapper would not reach them. `density` additionally *must* be on the root: it sets the
 * root font-size and every size in the system is `rem`.
 *
 * `appearance` is not here and never was: it writes a class, not an attribute.
 *
 * `source` says WHO emits the selectors the attribute matches, and identity is the first axis where
 * the answer is not us. The four non-colour axes are generated into `themes.css` by
 * `scripts/gen-theme.mjs`, so their value sets are fixed when this package is built and the drift
 * guards in `index.test.ts` can hold the table against the sheet. An identity's selectors come out
 * of `compile()`, from a document a TENANT authored — there is no `themes.css` block and no
 * `theme-data.json` table to check, and asserting there is one would fail for the right feature.
 * Hence a discriminator on the one table rather than a second constant: three things still have to
 * agree about identity (provider, SSR script, and now `compile`), which is the whole reason this
 * table exists at all.
 */
export const AXES: {
  key: keyof ThemePrefs;
  attr: string;
  def: string;
  source: "themes" | "document";
}[] = [
  { key: "radius", attr: "data-radius", def: "md", source: "themes" },
  { key: "font", attr: "data-font", def: "system", source: "themes" },
  { key: "monoFont", attr: "data-mono-font", def: "system", source: "themes" },
  { key: "density", attr: "data-font-size", def: "default", source: "themes" },
  // `def: ""` is what keeps a single-identity tenant's <html> byte-identical to today: the write
  // rule removes the attribute at the default, so nothing appears until a user picks a second one.
  { key: "identity", attr: "data-identity", def: "", source: "document" },
  // **The axis that used to be a preference the provider admitted it could not apply.**
  //
  // Colour was the one thing not driven by an attribute: a document was a stylesheet, so the server
  // read the cookie and served the right one before the first byte, and `KanzoThemeProvider` owned a
  // `palette` preference whose own JSDoc said "wiring this does not apply anything". That followed
  // from an assumption about size, and the assumption was never measured — the five documents this
  // package ships are 58 kB raw and **7.6 kB gzipped together**.
  //
  // So every document travels, `compile(doc, { scope })` puts each under its own attribute, and this
  // row is what selects. `def: ""` for the same reason `identity` has it: a tenant with one palette
  // writes no attribute and gets the `<html>` it had before. It also retires the requirement to
  // persist through `cookieStorageAdapter` — there is no longer a decision the server took that the
  // browser cannot correct without a flash.
  { key: "palette", attr: "data-palette", def: "", source: "document" },
];
