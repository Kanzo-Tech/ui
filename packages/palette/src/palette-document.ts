import type { Mode } from "./palette-check.js";
import { OBLIGATIONS, type Adjustment, type Ramp, type RampRelief } from "./ramp.js";

/**
 * The tenant palette document — the schema, and nothing else.
 *
 * White-label per client means a client's colour identity has to reach `--primary`, the surfaces,
 * the charts, the graph and the dashboards. This is the one artefact all of them read. It is derived
 * and measured **once**, at onboarding, and stored as data; runtime only *applies* it. Adding a
 * client therefore touches no code and needs no deploy, which is the whole requirement in one
 * sentence.
 *
 * Types only. `derive-palette.ts` produces one of these, `roles.ts` says what each token is bound
 * to, and `compile.ts` turns it into the single stylesheet that ships. Keeping the schema separate
 * from the derivation is what lets a *stored* document be read by code that can no longer produce
 * it — which is exactly the case `schemaVersion` exists for.
 */

/**
 * The shape of the fields below.
 *
 * Bumped when a field is added, removed or re-typed — never when a *value* changes.
 *
 * It answers a different question from `engine`, and neither can stand in for the other. `engine`
 * says which code produced the document: the package version, plus a hash over `OBLIGATIONS`, so a
 * change to what a step *owes* is detectable even inside one release. `schemaVersion` says only what
 * shape the document is in, so a reader can tell "I can still parse this" from "I must re-derive
 * it". A stored document whose engine hash is stale is still perfectly compilable — the values in it
 * are the values that were reviewed and signed off — and an onboarding screen should say so and
 * offer a re-derivation rather than refuse to paint. A stored document whose *schema* is stale
 * cannot be read at all. A document with no version at all is readable only by the exact code that
 * wrote it, which for an artefact meant to outlive a deploy is no answer.
 */
export const PALETTE_SCHEMA_VERSION = 2;

/** The six ramps a document carries. `brand` and `neutral` are the client's; the rest are Kanzo's. */
export type RampName = "brand" | "neutral" | "destructive" | "warning" | "success" | "info";

export const RAMP_NAMES = [
  "brand",
  "neutral",
  "destructive",
  "warning",
  "success",
  "info",
] as const satisfies readonly RampName[];

/**
 * The four status families, fixed by Kanzo and not client-overridable.
 *
 * Fixed, but **re-measured per tenant**: every obligation they carry is measured against the
 * surface, and the surface is the tenant's neutral. Constant input, per-tenant verdict — see
 * `PaletteRecord.crossChecks`, which is where that verdict is written down.
 */
export type StatusName = "destructive" | "warning" | "success" | "info";

export const STATUS_NAMES = [
  "destructive",
  "warning",
  "success",
  "info",
] as const satisfies readonly StatusName[];

/**
 * Six ramps × two modes, each exactly as `deriveRamp` returned it.
 *
 * Never post-edited. A ramp that has been touched after generation is a ramp whose `relief` is a
 * claim about values it no longer contains, and `checkRamp` re-measuring the stored steps is the
 * only thing standing between a stored document and that lie. `derive-palette.test.ts` runs that
 * re-measurement over every ramp in the document for exactly this reason.
 */
export type RampSet = Record<RampName, Record<Mode, Ramp>>;

/**
 * Where a document is in its life.
 *
 * Carried *in* the document rather than beside it in a table, because the document is the unit that
 * gets exported, mailed, reviewed and imported — "adding a client touches no code" only holds if the
 * artefact is self-describing. `draft` is what an onboarding screen shows next to the record;
 * `published` is what the server inlines; `retired` is kept so a screenshot from last quarter can
 * still be reproduced.
 */
export type PaletteState = "draft" | "published" | "retired";

/**
 * Which seed the neutral ramp's hue came from.
 *
 * The neutral ramp is *tinted* — a low chroma at a hue, Radix-style — and the tint is the thing most
 * likely to surprise a client, because it is the colour of 90% of the pixels and it is nearly
 * invisible in a swatch. So the provenance is a field: `neutral-seed` when the client gave one,
 * `brand` when they did not and the brand hue was carried over, `none` when there is no hue to
 * carry and the ramp is a true grey.
 */
export type HueSource = "neutral-seed" | "brand" | "none";

export interface TenantSeeds {
  /** The client's brand colour, as given. Determines step 9 of the brand ramp and nothing else. */
  brand: string;
  /** The neutral seed actually used — the client's, or the one derived from the brand hue. */
  neutral: string;
  /** The hue every neutral step was generated at, or `null` for a seed with no hue to keep. */
  neutralHue: number | null;
  neutralHueFrom: HueSource;
  /** Kanzo's four status seeds, copied in so the document explains itself without the package. */
  status: Record<StatusName, string>;
  /**
   * The page each mode's ramps were graded against.
   *
   * Recorded because every ratio in `record` is measured against it. A document that did not carry
   * its own surfaces would be a set of numbers about a page nobody could name.
   */
  surfaces: Record<Mode, string>;
}

export interface PaletteEngine {
  /** `@kanzo-tech/palette`'s version at derivation time — `derive-palette.ts` reads `../package.json`. */
  package: string;
  /**
   * A hash over `OBLIGATIONS` — what a step is required to do, not how it is generated.
   *
   * The package version moves for reasons that have nothing to do with colour. This moves only when
   * the *rules* change, which is the event that actually invalidates a stored measurement, and it
   * moves even for a change shipped inside one version.
   */
  obligations: string;
  /** ISO 8601. */
  derivedAt: string;
}

/**
 * Where the hues the set was built from came from.
 *
 * Carried because the two answers are different products, not two spellings of one. `brand-wheel` is
 * the normal case and the reason this layer exists: the source is `spokes` hues at even angles from
 * the brand's own, so every colour in the chart is the client's hue plus a published multiple of
 * `360 / spokes`. `default-scheme` is the one case where there is no hue to spin — a brand below
 * `CHROMA_FLOOR` — and the set is Kanzo's own eight colours, which is a real answer and not a
 * failure, but it is *not* the client's identity and a panel that could not tell the two apart would
 * show a grey-branded tenant the same "your palette is in your charts" line as everyone else.
 */
export interface CategoricalSource {
  from: "brand-wheel" | "default-scheme";
  /** The brand hue the wheel was spun from, or `null` when the brand had none to spin. */
  hue: number | null;
  /** The family that hue snapped to — the one family the set is guaranteed to contain. */
  family: string | null;
  /** How many spokes the wheel was cut into. `0` for the default-scheme fallback. */
  spokes: number;
}

/**
 * The categorical set — `--chart-1..N`, the colours that carry series identity.
 *
 * `capacity` is how many real categories the set can name, not how many `--chart-*` tokens exist.
 * Slots past it fold to the muted `OTHER`, which is what `roles.ts` binds them to.
 */
export interface CategoricalSet {
  /** The hues this was derived from, and whether they were the tenant's at all. */
  source: CategoricalSource;
  light: string[];
  dark: string[];
  /** `light.length` and `dark.length`. Both modes name the same categories, or the legend lies. */
  capacity: number;
  /** Every hue family the source yielded, before selection. */
  families: string[];
  /** The families that made the set. */
  kept: string[];
  /** Usable hues the set had no separation left for. Never conflated with `dropped`. */
  crowded: string[];
  /** Source colours that carried no usable hue at all. */
  dropped: string[];
  /** The worst adjacent pair under simulation, per mode. Never their minimum. */
  separation: Record<Mode, number>;
  /**
   * How many leading slots ended up clear of the status fills, per mode.
   *
   * An ask, not a guarantee: `orderScheme` degrades rather than refusing, so this is what the
   * colours allowed. Below it, an early series can be mistaken for a state.
   */
  leading: Record<Mode, number>;
}

/**
 * Token name → the value that ships. One map per mode.
 *
 * **Fully resolved, never `(ramp, step)` pairs an applier dereferences**, and that is the central
 * decision of the schema rather than a convenience.
 *
 * A document of bindings would make the role table a *runtime* contract. Move `--border` from step 5
 * to step 6 — which this design does — and every stored document silently repaints, including the
 * ones whose record a client already reviewed and approved against the old binding. The stored
 * artefact would no longer be the thing that was signed off; it would be an instruction to re-run a
 * derivation whose answer had changed underneath it.
 *
 * It would also drag the arithmetic onto the render path. Dereferencing a binding means carrying the
 * ramps, the elevation clamp, the per-seed `boundary` lookup and the alpha scale into the runtime,
 * and doing all of it before first paint — which is precisely the budget that "derivation is an
 * onboarding-time job" exists to keep empty. Resolved values make `compile` a string join.
 *
 * What is given up is small and worth naming: the document cannot say *why* a token has its value.
 * That is what `ROLES` is for — it is code, it is one table, and joining a token name to its binding
 * is a lookup a panel can do without the document having to carry one copy per role — 79 of them.
 */
export type RoleValues = Record<string, string>;

/** An `Adjustment` with the ramp and mode it happened in — a document has twelve ramps, not one. */
export interface TaggedAdjustment extends Adjustment {
  ramp: RampName;
  mode: Mode;
}

/** A `RampRelief` with the ramp and mode it was taken in. */
export interface TaggedRelief extends RampRelief {
  ramp: RampName;
  mode: Mode;
}

/**
 * A measurement no single ramp can make.
 *
 * A ramp grades itself against its **own** step 1 — an orange ramp's step 1 is the surface carrying
 * a trace of orange. The page a user actually sees is the **neutral** ramp's step 1, tinted with the
 * tenant's neutral hue. So "this status fill reads as a shape" and "this syntax colour is AA" are
 * questions that only exist once the six ramps are put in the same document, and their answers move
 * per tenant even though the status and syntax values are Kanzo-fixed. That is what "constant input,
 * per-tenant verdict" means, and this is where it is written down.
 *
 * These **report**; they never adjust. Adjustment is `deriveRamp`'s job and it has already happened
 * by the time these run — and the two things a cross-check could want to move are exactly the two
 * things that must not move: a Kanzo-fixed status or syntax value (a client's brand does not repaint
 * keywords) and a ramp step that is already the nearest legal value inside its own ramp.
 */
export interface CrossCheck {
  /** Stable key, so a panel can branch rather than parse prose. */
  id: string;
  mode: Mode;
  /** The token being graded. */
  token: string;
  /** The token it was graded against. */
  against: string;
  /**
   * A hard rule, or a documented relax.
   *
   * `relief` is the chart-slot contrast check: a mark is not text and can buy the difference back
   * with a relief channel — direct labels, a table view — so a slot under 3:1 obliges something of
   * the chart around it without failing the palette. `SchemeReport.relief` already draws this line;
   * a panel that reads every `ok: false` as a failure would report a legal palette as broken.
   */
  kind: "gate" | "relief";
  wanted: number;
  got: number;
  ok: boolean;
  /** The rule in one line, for a screen that has to explain a warning. */
  reason: string;
}

/**
 * Everything that did not go exactly as asked, written to be read by a person.
 *
 * The gate policy is *adjust and publish*: a client's brand red at 2.1:1 becomes a legal red of the
 * same hue, and this is where that is recorded. Never accept-and-warn, never refuse.
 */
export interface PaletteRecord {
  /** What each seed gave up, itemised by the rule that moved it, tagged with ramp and mode. */
  adjustments: TaggedAdjustment[];
  /**
   * Obligations that could not be met by moving anything.
   *
   * In practice this is `carries-identity` and almost nothing else. The neutral ramp always takes
   * it — a neutral is *supposed* to sit below the chroma floor — so a panel should read it as a
   * statement about the seed rather than as a defect. It is the one obligation that can never become
   * an adjustment: the nearest legal value for a colour with no identity is a hue *we* would be
   * choosing, and manufacturing brand out of grey is the thing this layer exists to refuse.
   */
  relief: TaggedRelief[];
  /** The measurements that only exist once six ramps share one page. */
  crossChecks: CrossCheck[];
}

/**
 * One tenant's colour identity, derived and measured once, applied everywhere.
 *
 * Read by `compile` to make the stylesheet, and by the onboarding screen to explain itself. There is
 * no other place to configure colour: the graph, the dashboards and the charts are all *readings* of
 * this document, not separate settings that happen to agree with it.
 */
export interface TenantPalette {
  schemaVersion: number;
  /** Stable per tenant. It is what the server looks up at request time. */
  id: string;
  /** Human-facing name, for the onboarding screen and the docs showcase. */
  label: string;
  state: PaletteState;
  seeds: TenantSeeds;
  engine: PaletteEngine;
  ramps: RampSet;
  categorical: CategoricalSet;
  /** The tokens, resolved, per mode. What `compile` emits and the only thing runtime needs. */
  roles: Record<Mode, RoleValues>;
  record: PaletteRecord;
}

/**
 * A stable digest of the obligation table.
 *
 * FNV-1a over the table's JSON, rather than a crypto hash: this runs in the browser and in Node and
 * in a test, and the property wanted is "changes when the rules change", not preimage resistance.
 * 32 bits is ample for telling one obligation table from another — there are two of them in the
 * project's history, not two billion.
 *
 * Over `OBLIGATIONS` and not over `ramp.ts`, deliberately. A refactor of the generator that produces
 * identical values should not invalidate a stored document; a change to what step 9 *owes* should,
 * even if it ships in the same patch release.
 */
export function hashObligations(obligations: typeof OBLIGATIONS = OBLIGATIONS): string {
  const text = JSON.stringify(obligations);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
