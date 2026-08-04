import paletteDataJson from "../palette-data.json";

/**
 * `@kanzo-tech/palette` — the colour derivation. Two seeds in, a measured tenant document out.
 *
 * **Authoring-time only.** A tenant's palette is derived and measured ONCE, at onboarding, and
 * stored as data; the runtime does nothing but apply the stored document. That is why this is a
 * package rather than a subpath of `@kanzo-tech/theme`: the categorical search alone costs
 * **seconds** per tenant — `WHEEL_SPOKES` in `derive-palette.ts` carries the measured table, and is
 * the one place that figure is written — so out of the browser's dependency graph it *cannot* be
 * imported, rather than merely should not. `@kanzo-tech/theme` depends on this package as a
 * **devDependency** — its generator and its tests use it, a browser never does.
 *
 * Nothing here reads the DOM, and nothing here is a React component.
 */

/**
 * The generated tables the derivation reads, as a JS module.
 *
 * Inputs to the maths, not outputs of it: Tailwind's chromatic families, the named greys, the
 * default categorical scheme, the base16 sources and their seed pairs, the base16 → syntax role
 * mapping and the four status seeds. Read them through this export rather than importing
 * `../palette-data.json`: a raw JSON subpath import is an ESM JSON import at runtime, which Node
 * rejects without `with { type: "json" }`, and Rollup strips that attribute when bundling.
 */
export const paletteData = paletteDataJson;
export type PaletteData = typeof paletteDataJson;

/**
 * The base16 sources — the authored strips, and the only two things that still read them.
 *
 * The 13 `--kanzo-syntax-*` roles are Kanzo's own slots through the base16 role mapping and stay
 * Kanzo-fixed per tenant; the docs showcase displays an authored original beside its derived
 * result. Neither is a palette any more — see `PALETTE_SEEDS`.
 *
 * Named for what it holds rather than what it used to be. "Palette" had come to mean three
 * different things at once — these raw strips, the seeds derived from them, and the tenant
 * document itself — which is the same collision as `--accent` against `data-accent`, and the
 * reason a reader could not tell which one a call site meant.
 */
export const BASE16_SLOTS = paletteDataJson.palettes as Record<
  string,
  { label: string; slots: Record<string, string> }
>;

/**
 * The categorical-palette checks — the gate every scheme passes before it is registered.
 *
 * Exported from the domain because the rule and the data belong together: anything deriving a
 * scheme (from a seed's hues, from a customer's ramps) needs the same verdict this package's own
 * tests apply, not a copy of it.
 */
export {
  BAND,
  CHROMA_FLOOR,
  CONTRAST_MIN,
  CVD_FLOOR,
  CVD_TARGET,
  NORMAL_FLOOR,
  SURFACE,
  TEXT_MIN,
  checkScheme,
  contrast as contrastRatio,
  deltaE,
  hueDistance,
  oklch,
  type CvdKind,
  type Mode,
  type PairList,
  type SchemeReport,
} from "./palette-check.js";

/**
 * The anti-corruption layer: a seed contributes hues, the system's ramps contribute lightness and
 * chroma, and the checks decide. Measured, not assumed — no borrowed identity tested so far passes
 * as a categorical scheme in its own values.
 */
export {
  FAMILY_GAP,
  SEPARATION_BAR,
  allPairsCap,
  deriveOrderedScheme,
  deriveScheme,
  deriveSchemeColors,
  familyAtHue,
  familyOf,
  familyStandard,
  leadingClear,
  orderScheme,
  type Derivation,
  type DeriveOptions,
  type OrderedDerivation,
  type OrderOptions,
  type SchemeDerivation,
} from "./derive-scheme.js";

/**
 * The ramp — one seed, twelve steps, each carrying a measured obligation.
 *
 * `OBLIGATIONS` in particular is the table a document's engine hash is taken over, so a consumer
 * that wants to know whether a stored palette is stale needs to be able to see it.
 */
export {
  CHROMA_PROFILE,
  GROWTH,
  OBLIGATIONS,
  RAMP_LENGTH,
  TINT_FLOOR,
  TINT_PROFILE,
  TINT_REFERENCE,
  alphaOver,
  checkRamp,
  deriveRamp,
  maxChroma,
  over,
  toHex,
  type Adjustment,
  type Obligation,
  type Ramp,
  type RampDrift,
  type RampRelief,
} from "./ramp.js";

/**
 * The tenant palette document — the schema, the role table, the derivation and the compiler.
 *
 * One document per client, derived and measured once at onboarding and applied at runtime. It is
 * what makes white-labelling a data problem instead of a deploy: a client's identity reaches
 * `--primary`, the surfaces, the charts and the graph because all of them read the same artefact.
 */
export {
  PALETTE_SCHEMA_VERSION,
  RAMP_NAMES,
  SHARED_RAMP_NAMES,
  STATUS_NAMES,
  hashObligations,
  type CategoricalSet,
  type CategoricalSource,
  type CrossCheck,
  type HueSource,
  type Identity,
  type PaletteEngine,
  type PaletteRecord,
  type PaletteState,
  type RampName,
  type RampSet,
  type RoleValues,
  type SharedRampName,
  type SharedRampSet,
  type StatusName,
  type TaggedAdjustment,
  type TaggedRelief,
  type TenantPalette,
  type TenantSeeds,
} from "./palette-document.js";

export {
  CHART_SLOTS,
  ELEVATION,
  ELEVATION_CEILING,
  IDENTITY_RELIEF,
  IDENTITY_TOKENS,
  OTHER,
  ROLES,
  SOLID_STEP,
  elevate,
  fillStep,
  isIdentityRole,
  recessFill,
  resolveRoles,
  type ResolvedRole,
  type Role,
  type RoleBinding,
  type SurfaceName,
} from "./roles.js";

export {
  CATEGORICAL_LEADING,
  STATUS_SEEDS,
  WHEEL_SPOKES,
  categoricalSource,
  derivePalette,
  baseSeedFor,
  type DerivePaletteInput,
  type IdentityInput,
} from "./derive-palette.js";

export { KANZO_ID, PALETTE_SEEDS, seedInput, type PaletteSeeds } from "./seeds.js";

/**
 * The syntax set — the last corner of the table that was `kind: "fixed"`, and is now derived.
 *
 * Seven roles, because six of the thirteen had an owner already: `comment` is `--faint`,
 * `punctuation` is `--muted-foreground`, `operator` is `--foreground`, `invalid` is the destructive
 * family, and inserted/deleted/changed were success/destructive/warning all along.
 */
export {
  SYNTAX_BAND,
  SYNTAX_ROLES,
  SYNTAX_SEPARATION,
  deriveSyntax,
  type SyntaxAdjustment,
  type SyntaxDerivation,
  type SyntaxRelief,
  type SyntaxRole,
  type SyntaxSeeds,
} from "./derive-syntax.js";

export {
  DEFAULT_SYNTAX_SOURCE,
  fromBase16,
  fromHexes,
  fromVsCode,
  seedsFor,
  type SyntaxSourceRef,
  type TokenColor,
  hasBase16,
} from "./syntax-source.js";

export { compile, type CompileOptions } from "./compile.js";
