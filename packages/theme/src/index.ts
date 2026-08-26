import themeDataJson from "../theme-data.json";
import type { SectionPrefDecl } from "./sections.js";

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
 * There is no derivation any more, so there are no tables for one to read: a theme is
 * `themes/<name>.css`, hand-written source, and `themes` below is the catalogue read off disk by
 * the generator so no second list can drift from it.
 */
export const themeData = themeDataJson;
export type ThemeData = typeof themeDataJson;

/**
 * The themes this package ships, as data a picker can render.
 *
 * daisyUI keeps two registries — `themeOrder` (the ordered names) and `theme/object` (name → the
 * variable map) — precisely so a switcher can draw a theme without parsing its CSS. This is the
 * first: an entry carries what a control needs to *offer* a theme and nothing a page needs to
 * *paint* one, which is the theme's own stylesheet's job.
 *
 * **It replaces `paletteIndex`, and it is a flat list where that was a tree.** A palette used to
 * contain identities, so an entry had `children` and a picker had two levels. A brand is a theme
 * now, so `bank` and `bank-private` sit side by side and the second level is gone.
 *
 * Generated from the directory, not listed: `scripts/gen-theme.mjs` reads `themes/` and records
 * each file's own `color-scheme`. Adding a theme is adding a file.
 *
 * Read through this export rather than importing `@kanzo-tech/theme/theme-data.json`, for the
 * reason given on {@link themeData}: a raw JSON subpath import is an ESM JSON import at runtime, and
 * Rollup strips the attribute that would make it legal.
 */
export const themeIndex = themeDataJson.themes as ThemeIndexEntry[];

/**
 * One theme, as a control sees it.
 *
 * **It carries no colours.** A theme travels in the page under its own `[data-theme]`, so a control
 * depicts one by *setting the attribute* and letting the cascade answer — which is also why a
 * preview is a `div` and not a strip of swatches. A handful of hexes could not depict a theme
 * anyway; on the default's own, two of the four a picker used to publish were the same value.
 *
 * `dark` is the theme's own `color-scheme`, and it is the whole of what "a theme is one mode"
 * means at this layer: it is a property of the theme, not a second axis crossed with it.
 */
export interface ThemeIndexEntry {
  name: string;
  dark: boolean;
}

/**
 * How many `--chart-N` custom properties the stylesheet declares. A 9th series folds into "Other" —
 * never cycle, or identity stops meaning anything. (`--chart-capacity` is declared beside them and
 * is not one of them; `boundary.test.ts` counts `--chart-N` only.)
 *
 * A fact about the SHEET, which is why it is here and not with the derivation that emits it: a
 * chart resolving `var(--chart-N)` off the cascade needs the count, and a chart runs in a browser
 * and is checked against the shipped theme files rather than trusted. The count is a compile-time constant
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
 * **Colour IS an axis now, and it is the same kind of axis as the rest.** A theme is one flat block
 * of CSS under `[data-theme="<name>"]` — about fifty-five declarations somebody writes, pastes and
 * diffs — so applying one is writing an attribute, exactly like radius or density. It stopped being
 * special when it stopped being the output of a thirteen-stage derivation.
 *
 * Everything is driven by `data-*` attributes on `<html>`, and the values live in `themes.css`:
 * · `data-theme`      — selects a whole theme: its colours, its shape knobs and its fonts.
 * · `data-radius`     — the three radius knobs, as a user preference over the theme's own.
 * · `data-font`       — sets `--font-sans` / `--font-heading`.
 * · `data-mono-font`  — sets `--font-mono`.
 * · `data-font-size`  — sets the root font-size (the rem density scale).
 *
 * **`data-theme` is `data-palette` and `data-identity` collapsed, and the authority question they
 * modelled has dissolved rather than been decided.** `data-palette` selected from a catalogue the
 * LIBRARY shipped, so a user picking Dracula could overrule a client's branding; `data-identity`
 * selected among brands the CLIENT authored, one level down. A tenant's brands are now themes
 * beside every other theme, so what a user may choose is what the tenant's policy admits — the
 * `pinned` / `hidden` chain that already governs every other section, rather than two attributes
 * with different pedigrees.
 *
 * Writing the attributes is `<KanzoThemeProvider>`'s job, from `@kanzo-tech/ui`. It sets them on
 * `document.documentElement` — see the AXES note below for why a wrapper element cannot work.
 *
 * Dark mode is not a token flip any more: a theme carries its own `color-scheme` and its own
 * colours, so `.dark` survives only as the selector for the `dark:` VARIANT at the call sites that
 * still ask for one.
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
 * The appearance PREFERENCE — an explicit side, or `""` for "ask the OS".
 *
 * A value and not an absent key: the read-time whitelist is built from `Object.keys(DEFAULT_PREFS)`,
 * so a key missing from the default blob is dropped on every read. It also survives
 * `JSON.stringify` into both storage adapters, which an `undefined` would not.
 *
 * **`""` and not `null`, which is what it was.** Unset is the same value here as everywhere else in
 * this package: a theme key stores `""` for "defer to the tenant", and the write rule
 * removes an attribute at the default. Two spellings of one idea is what kept appearance out of the
 * declaration — a `SectionPrefDecl`'s values are strings — and therefore out of the one resolution
 * chain, which is the whole of what {@link CORE_PREFS} exists to end. Declared, "follow the OS" is
 * `{ value: "", label: "System" }`: a thing a control can offer, rather than something reachable
 * only through the panel's Reset button.
 */
export type AppearancePref = Appearance | "";

/** Radius steps (`md` = 0.5rem default). */
export type KanzoRadius = "none" | "xs" | "sm" | "md" | "lg";

/** Density (root font-size rem-scale); `default` omits the attribute. */
export type KanzoDensity = "default" | "compact" | "comfortable";

/** Sans font key — host-extensible; the DS ships `system`/`geist`/`inter` stacks. */
export type KanzoFont = "system" | "geist" | "inter" | (string & {});

/** Mono font key — host-extensible; the DS ships `system`/`geist-mono`/`jetbrains-mono`. */
export type KanzoMonoFont = "system" | "geist-mono" | "jetbrains-mono" | (string & {});

/**
 * Theme key — host-extensible; `""` means "defer to the tenant's default".
 *
 * This is `KanzoFont`'s case, not `KanzoRadius`': a value is a *host's* string, unknown when this
 * package is built. Where `KanzoFont` still names the three stacks the DS happens to ship, there is
 * nothing to union here — a tenant authors their own themes, so a literal union would be a list
 * that is wrong for every client.
 *
 * **It replaces `KanzoPalette`, `KanzoIdentity` and `KanzoIdentityMemory`, and the collapse is the
 * point.** Those were three types because a palette CONTAINED identities: a document was a two-mode
 * stylesheet, a brand was a partial block layered onto it, and a memory recorded which brand you
 * last wore inside each document so switching away and back returned you to it. A theme is one flat
 * block, so a brand is not inside anything — `bank` and `bank-private` are two themes — and there is
 * no containment left for a memory to remember.
 */
export type KanzoThemeName = string;

/**
 * One published theme, as the runtime sees it — the contract between the catalogue and the panel.
 *
 * It carries no colours, and it has no `children`. A control depicts a theme by setting
 * `data-theme` on an element and letting the cascade paint it: the theme is already in the page, so
 * a depiction copied out of it is a second spelling that can only ever be the same colours or the
 * wrong ones.
 *
 * **`children` went with the containment it modelled.** A palette used to hold brands, so an option
 * held options and the panel flattened a tree into one list. There is no tree: a brand is a theme.
 */
export interface ThemeOption {
  value: string;
  label: string;
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
  /**
   * Which theme this user wears on each side — `{}` while they have chosen neither.
   *
   * A map rather than a string because the choice is per appearance, and with one-mode themes that
   * is not a refinement but the only shape available: a theme IS a side, so "which theme" without
   * "on which side" does not name a preference. It is also exactly what the per-appearance palette
   * proposal asked for, arrived at from the other
   * direction — that proposal invented a map over documents that each carried both modes, to say
   * something the two-mode document made awkward and the one-mode theme makes trivial.
   *
   * The ordering that makes it possible: the pre-hydration script resolves appearance before it
   * writes anything, so it can index this map. That is the thing to check first when touching it.
   */
  themeByAppearance: Partial<Record<Appearance, KanzoThemeName>>;
  /**
   * What the packages a host installed contribute, keyed by namespace then by preference.
   *
   * **One key, and that is what makes an absent package harmless.** The read-time whitelist is built
   * from `Object.keys(DEFAULT_PREFS)` and drops everything else, which is right for the retired
   * colour axes it was built for and exactly wrong for a contributed choice: a host that drops an
   * optional peer for one release would lose the user's stored value on the next write. Riding on a
   * single known key, an unrecognised namespace survives every read and save without the core
   * knowing it exists — the same opacity {@link LookDocument}'s `sections` already has, which is the
   * point: both halves of a section are stored the same way.
   */
  sections: Record<string, Record<string, string>>;
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
  // `""`, not `"system"` and no longer `null`: the default is to have no side pinned, spelled the
  // way every other deferral in this table is — a theme key of `""` defers to the tenant, this
  // defers to the OS. One spelling is what lets it be declared, and therefore resolved, like the rest.
  appearance: "",
  radius: "md",
  font: "system",
  monoFont: "system",
  density: "default",
  // Empty, and both sides fall through to the tenant's default — so a tenant shipping one theme per
  // side stores nothing and gets the `<html>` it always had. `""` per side means the same thing:
  // defer to whichever theme the tenant made default.
  themeByAppearance: {},
  // Empty, and never seeded from the registered manifests: a section's default is what `resolvePref`
  // answers when nothing is stored, so writing it in here would turn every default into a *stored
  // choice* the first time the panel opened — and a default that has been stored can no longer move
  // when the section, or the tenant's policy, changes it.
  sections: {},
};

export const STORAGE_KEY = "kanzo_theme_prefs";

/**
 * The core's own preferences, declared — one entry per axis, in the shape a package contributes.
 *
 * **Generated, and that is the point.** `scripts/gen-theme.mjs` authors the values *and* the
 * declaration, so the option list a control offers is the table the CSS was emitted from rather than
 * a hand-copy beside it. `Preferences.tsx` held two such copies — `RADII` and `DENSITIES` — sitting
 * next to the generated tables they duplicated, and `KanzoThemeProvider` held a third of the font
 * stacks with a fallback string that had already drifted from the sheet's. Adding a font is now one
 * line in the generator: the panel grows a card and the docs table grows a row.
 *
 * The rule this installs, and it is the same one the colour half follows: **a configuration is
 * authored once, where its values live.** The declaration, the control, the default and the
 * attribute are resolved from it.
 *
 * `source` is the one field a contributed preference has no use for. It says WHO emits the selectors
 * the attribute matches: `"themes"` is our generator, so the drift guards in `index.test.ts` can
 * hold the declaration against the sheet; `"document"` is `compile()`, from something a TENANT
 * authored after this package was built, and asserting a generated table for it would fail for the
 * right feature.
 */
export type CorePrefDecl = SectionPrefDecl & { source?: "themes" | "document" };

/**
 * Cast, because JSON is data and TypeScript reads it as widened literals — `kind: string` will not
 * narrow to the union however it is written. The check is therefore a runtime one, in
 * `index.test.ts`: every key is a key of `DEFAULT_PREFS`, every declaration is well-formed, and
 * `check:generated` regenerates the file and fails on a diff.
 */
export const CORE_PREFS = themeData.prefs as unknown as Readonly<Record<CorePrefKey, CorePrefDecl>>;

/**
 * Every preference the core declares — which is every key of {@link ThemePrefs} except the two that
 * are not choices at all.
 *
 * Written as an exclusion rather than a list, so the two exceptions have to justify themselves:
 * `identityByPalette` is a *memory* (what this user last wore in each document, consulted only when
 * the palette changes), and `sections` is the opaque bag another package's preferences ride in. A
 * new axis appears here by appearing in `ThemePrefs`, and the generator has to answer for it.
 */
export type CorePrefKey = Exclude<keyof ThemePrefs, "sections">;

/**
 * The namespace the core's own preferences answer to in a tenant's policy.
 *
 * **The core is a section like any other, and this is the whole of what that costs.** A policy is
 * keyed by namespace — `{ theme: { radius: { pinned: "sm" } }, graph: { look: { hidden: true } } }`
 * — so a client shipping *compact and square* uses the mechanism an optional package already uses,
 * and one chain answers for colour, geometry and a contributed choice alike.
 *
 * That is daisyUI's insight, in the mechanism this repo already had: their theme carries the
 * geometry (`--radius-box`, `--size-field`, `--depth`) in the same document as the colours, so a
 * tenant ships a coherent whole rather than a panel of unrelated knobs. Ours went half-way there
 * when a palette became a document; the half not taken was that radius, density and the fonts had no
 * document-level default at all — only a user could move them.
 */
export const CORE_NAMESPACE = "theme";

/**
 * Each axis → its `<html>` attribute + default value (at the default the attribute is removed).
 *
 * A projection of {@link CORE_PREFS} and no longer a table of its own: three things must agree about
 * an axis — the React provider, the SSR pre-hydration script, and the generator that decides which
 * selectors exist at all — and they now agree because there is one place to disagree with.
 *
 * These attributes go on `<html>`, never a wrapper element. Ark overlays (Dialog, Popover,
 * Menu, Select, Tooltip, Toast…) portal to `document.body`, outside any wrapper, so tokens set
 * on a wrapper would not reach them. `density` additionally *must* be on the root: it sets the
 * root font-size and every size in the system is `rem`.
 */
export const AXES: {
  key: keyof ThemePrefs;
  attr: string;
  def: string;
  source: "themes" | "document";
  /** See {@link SectionPrefDecl}. The stored value is a map keyed by the resolved appearance. */
  byAppearance?: true;
}[] = Object.entries(CORE_PREFS)
  // The rows with somewhere to write. `appearance` is declared beside these and is not one: it
  // writes a class. A contributed preference makes the same distinction with the same field.
  .filter(([, decl]) => Boolean(decl.attr))
  .map(([key, decl]) => ({
    key: key as keyof ThemePrefs,
    attr: decl.attr as string,
    def: decl.default,
    source: decl.source ?? "themes",
    byAppearance: decl.byAppearance,
  }));

// ── Sections ────────────────────────────────────────────────────────────────────────────────────
//
// The mechanism only. The core exports the document shape, the fallback resolver and the validator,
// and knows no section: a package contributes by USING a namespace, never by registering here.
// That is what keeps `@kanzo-tech/theme` free of any reference to `@kanzo-tech/graph`.
export {
  fallbackChain,
  resolvePref,
  prefBoolean,
  prefNumber,
  prefOptions,
  resolveSectionToken,
  sectionOf,
  validatePrefs,
  validateSection,
  withSection,
  type LookDocument,
  type PrefOption,
  type PrefOptions,
  type PrefOrigin,
  type PrefSource,
  type PrefSources,
  type Problem,
  type ResolvedPref,
  type SectionManifest,
  type SectionPolicy,
  type SectionPrefDecl,
  type SectionPrefPolicy,
  type SectionTokenDecl,
} from "./sections.js";

// The density axis's own obligations — what admits it as a section rather than a preference.
export {
  check as checkDensity,
  OBLIGATIONS as DENSITY_OBLIGATIONS,
  type Check as DensityCheck,
  type Obligation as DensityObligation,
} from "./obligations.js";

// Authoring-time colour, and the only derivation in the package. It runs in a form while somebody
// picks a fill, never in a page painting one: what ships is still a flat block of hex, and this is
// how the boring half of it stops being typed by hand. See `ink.ts` for the measurements.
export {
  AA,
  contrast,
  hex,
  inkFor,
  oklch,
  pageInk,
  type Oklch,
} from "./ink.js";
