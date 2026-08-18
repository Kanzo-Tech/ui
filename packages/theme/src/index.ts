import paletteIndexJson from "../palettes/index.json";
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
 * **It carries no colours, and that is recent.** Every entry used to publish four hexes per mode —
 * background, foreground, primary, border — for a picker to draw as a strip. Nothing reads them: a
 * document is compiled under its own `[data-palette]` and travels in the page, so a control depicts
 * a palette by *setting the attribute* and letting the cascade answer. Four hexes could not depict a
 * document anyway; on Kanzo's own, two of them were the same value.
 */
export interface PaletteIndexEntry {
  id: string;
  label: string;
  /** The one `tokens.css` already carries; it has no stylesheet of its own to load. */
  isDefault: boolean;
  seeds: { brand: string; base: string };
  capacity: number;
  /** The brands inside this document, **default first**. One entry means there is no choice here. */
  identities: { id: string; label: string }[];
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
 * The appearance PREFERENCE — an explicit side, or `""` for "ask the OS".
 *
 * A value and not an absent key: the read-time whitelist is built from `Object.keys(DEFAULT_PREFS)`,
 * so a key missing from the default blob is dropped on every read. It also survives
 * `JSON.stringify` into both storage adapters, which an `undefined` would not.
 *
 * **`""` and not `null`, which is what it was.** Unset is the same value here as everywhere else in
 * this package: `identity` and `palette` store `""` for "defer to the document", and the write rule
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
 * option are the same thing at different grain — an id and a name a client wrote — and two names for
 * one shape is the defect this layer keeps removing. What differs between the axes is
 * what selecting one *does*, not what a control needs to offer it.
 *
 * Declared here rather than imported, the way `CHART_SLOTS` is declared in both packages: the
 * document's own `Identity` carries `brand`, `ramp`, `categorical` and `record`, none of which a
 * browser has any use for, and `boundary.test.ts` keeps `@kanzo-tech/palette` out of the runtime
 * graph with a TEXT match — so even `import type` fails, and rightly. A host maps its document to
 * this shape once, on the server.
 *
 * `value` / `label` because that is `FontOption`: identity is the host-extensible axis. Where
 * `FontOption` has `preview`, this has **nothing** — and the absence is the point. It carried
 * `swatches`, four hexes per mode for a picker to draw as a strip, and it was named `SwatchOption`
 * after them. A control depicts a palette by setting `data-palette` on an element and letting the
 * cascade paint it: the document is already in the page, so a depiction copied out of it is a second
 * spelling that can only ever be the same colours or the wrong ones.
 *
 * The rename came with the deletion rather than after it. A type named for a field it no longer has
 * is the failure this layer keeps finding in its own vocabulary.
 */
export interface PaletteOption {
  value: string;
  label: string;
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
  children?: PaletteOption[];
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
  /**
   * Which document this user wears on each side — `{}` while they have chosen neither.
   *
   * A map rather than a string because the choice is per appearance: a light-native palette and a
   * dark-native one are different products of taste even though each carries both modes. Unlike
   * {@link KanzoIdentityMemory} this IS an axis, and the difference is one of ordering rather than
   * of principle — the pre-hydration script resolves appearance before it writes anything, so it
   * can index this; nothing resolves the palette before the same loop.
   */
  paletteByAppearance: Partial<Record<Appearance, KanzoPalette>>;
  identityByPalette: Record<KanzoPalette, KanzoIdentity>;
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
  // way every other deferral in this table is — `identity: ""` defers to the document, this defers
  // to the OS. One spelling is what lets it be declared, and therefore resolved, like the rest.
  appearance: "",
  radius: "md",
  font: "system",
  monoFont: "system",
  density: "default",
  identity: "",
  // Empty, and both sides fall through to the tenant's default — so a tenant publishing one palette
  // stores nothing and gets the `<html>` it always had. `""` per side means the same thing one level
  // in: defer to the document the tenant made default.
  paletteByAppearance: {},
  // A fresh browser remembers nothing, and an empty map is not a special case anywhere: every read
  // is `memory[id] ?? ""`, which is the same answer as "this palette's default identity".
  identityByPalette: {},
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
export type CorePrefKey = Exclude<keyof ThemePrefs, "identityByPalette" | "sections">;

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
  type SectionBinding,
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
