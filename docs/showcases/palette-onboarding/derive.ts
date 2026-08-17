import {
  BASE16_SLOTS,
  KANZO_ID,
  PALETTE_SEEDS,
  RAMP_NAMES,
  compile,
  derivePalette,
  fillStep,
  seedInput,
  type Identity,
  type RampName,
  type RampSet,
  type TaggedAdjustment,
  type TaggedRelief,
  type TenantPalette,
} from "@kanzo-tech/palette";
import { HALLS, type Hall } from "@/example/world";

/**
 * A hall's heraldry, run through the real derivation — on the server, at build time.
 *
 * `heraldry: { brand, neutral }` on a `Hall` is not a decoration that happens to be two hexes: it
 * is exactly the pair `derivePalette` takes, so "the Order of Salt's colours" and "that tenant's
 * document" are one sentence. Registering a hall is calling this function.
 *
 * This is the honest place for it. Deriving a document costs 0.2–4.0 s per hall here (the
 * categorical search dominates), which is fine once at registration and unacceptable in a browser;
 * the client half of this showcase receives the projection below and never sees `derivePalette`.
 */

export interface RampView {
  name: RampName;
  seed: string;
  hue: number | null;
  light: string[];
  dark: string[];
  boundary: { light: number; dark: number };
  onSolid: { light: string; dark: string };
}

/**
 * One tenant, read through **one** identity — the default one, the brand `:root` carries.
 *
 * A document stores five shared ramps and a brand ramp per identity, so "the brand ramp" is only a
 * phrase once an identity is named. Every shipped seed pair publishes exactly one, so this
 * projection is the whole document; a multi-brand tenant would need one view per identity.
 */
export interface PaletteView {
  id: string;
  label: string;
  /** Tab-width name — a hall's short form, since `The Lanternwood Compact` is not a tab. */
  short: string;
  /** The hall whose heraldry this is. Null for Kanzo's own document, which belongs to no hall. */
  hall: Hall | null;
  brandSeed: string;
  baseSeed: string;
  baseHue: number | null;
  baseHueFrom: string;
  fillStep: number;
  primary: { light: string; dark: string };
  ramps: RampView[];
  adjustments: TaggedAdjustment[];
  relief: TaggedRelief[];
  categorical: {
    from: string;
    family: string | null;
    capacity: number;
    families: string[];
    kept: string[];
    crowded: string[];
    dropped: string[];
    light: string[];
    dark: string[];
    /** `null` per mode where the document declines the channel: no pair exists to be the worst. */
    separation: { light: number | null; dark: number | null };
  };
  /** The sixteen authored base16 slots, when this seed pair was lifted from one. */
  authored: {
    label: string;
    slots: [slot: string, hex: string][];
    /** Which slot each seed was taken from, matched rather than transcribed. */
    brandSlot: string | null;
    baseSlot: string | null;
  } | null;
  css: string;
  ms: number;
}

function authoredFor(id: string, brand: string, base: string): PaletteView["authored"] {
  // Not for the default tenant, and the direction is the reason: Kanzo's seeds were not lifted from
  // a base16 palette — Kanzo's base16 palette was derived FROM the seed. `BASE16_SLOTS` carries it
  // for the syntax roles, so the lookup succeeds and would render "authored, and derived" about a
  // colour nobody authored elsewhere. Worse, its brand and base are the same grey, so both would
  // report `base03`.
  if (id === KANZO_ID) return null;
  const source = BASE16_SLOTS[id];
  if (!source) return null;
  const slots = Object.entries(source.slots);
  const slotOf = (hex: string) =>
    slots.find(([, value]) => value.toLowerCase() === hex.toLowerCase())?.[0] ?? null;
  return {
    label: source.label,
    slots,
    brandSlot: slotOf(brand),
    baseSlot: slotOf(base),
  };
}

/**
 * The identity `:root` paints, by name.
 *
 * `identities[0]` would be the client's first, which is not the same question: the order is theirs
 * to choose and `defaultIdentity` is theirs to nominate, and a document may differ on the two.
 */
function defaultIdentityOf(doc: TenantPalette): Identity {
  const identity = doc.identities.find((it) => it.id === doc.defaultIdentity);
  if (!identity) throw new Error(`${doc.id} names no identity "${doc.defaultIdentity}"`);
  return identity;
}

/**
 * One seed pair, derived and projected — for a shipped palette at build time, for a hall's
 * heraldry, or for two hex values a visitor typed, through the server action beside this file.
 *
 * The same function every way, deliberately: a shipped palette is not a privileged shape, it is a
 * tenant whose seeds happen to be committed. If the tool ran a different path from the gallery, the
 * gallery would stop being evidence about the tool.
 *
 * The second parameter is presentation only — a tab label, and the hall the seeds belong to when
 * they belong to one. It defaults, so a caller who has only seeds passes only seeds.
 */
export function viewOf(
  seeds: { id: string; label: string; brand: string; base: string },
  { short, hall }: { short?: string; hall?: Hall | null } = {},
): PaletteView {
  const { id } = seeds;
  const tab = short ?? seeds.label;

  const started = performance.now();
  const doc = derivePalette(seedInput(id, seeds));
  const ms = Math.round(performance.now() - started);

  // The six ramps a *resolution* happens against — the document's five, plus the one brand the
  // default identity carries. `RampSet` is the type the library already has for exactly this join.
  const identity = defaultIdentityOf(doc);
  const ramps: RampSet = { ...doc.ramps, brand: identity.ramp };
  const categorical = identity.categorical;

  return {
    id,
    label: doc.label,
    short: tab,
    hall: hall ?? null,
    brandSeed: doc.seeds.brand,
    baseSeed: doc.seeds.base,
    baseHue: doc.seeds.baseHue,
    baseHueFrom: doc.seeds.baseHueFrom,
    // The library's own rule, not a re-derivation of it: 9 normally, 12 for a brand ramp that
    // reports `carries-identity`. That difference is the whole of the monochrome case.
    fillStep: fillStep(identity.ramp),
    primary: { light: doc.roles.light["--primary"] ?? "", dark: doc.roles.dark["--primary"] ?? "" },
    ramps: RAMP_NAMES.map((name) => ({
      name,
      seed: ramps[name].light.seed,
      hue: ramps[name].light.hue,
      light: ramps[name].light.steps,
      dark: ramps[name].dark.steps,
      boundary: { light: ramps[name].light.boundary, dark: ramps[name].dark.boundary },
      onSolid: { light: ramps[name].light.onSolid, dark: ramps[name].dark.onSolid },
    })),
    // Brand rows first, then the shared ones: the record is split by which seed moved, and the
    // screen is read top-down by a client who came here to see what happened to *their* colour.
    adjustments: [...identity.record.adjustments, ...doc.record.adjustments],
    relief: [...identity.record.relief, ...doc.record.relief],
    categorical: {
      from: categorical.source.from,
      family: categorical.source.family,
      capacity: categorical.capacity,
      families: categorical.families,
      kept: categorical.kept,
      crowded: categorical.crowded,
      dropped: categorical.dropped,
      light: categorical.light,
      dark: categorical.dark,
      separation: categorical.separation,
    },
    authored: authoredFor(id, seeds.brand, seeds.base),
    css: compile(doc),
    ms,
  };
}

/**
 * One shipped seed pair — Kanzo's own, or one of the four borrowed identities.
 *
 * Memoised per id rather than per list: Kanzo appears in both sets below, and a second derivation
 * of the same seeds is seconds of build time spent proving the function is deterministic.
 */
const memo = new Map<string, PaletteView>();

function shipped(id: string): PaletteView {
  const seeds = PALETTE_SEEDS[id];
  if (!seeds) throw new Error(`no seed pair named ${id}`);
  const cached = memo.get(id) ?? viewOf({ id, ...seeds });
  memo.set(id, cached);
  return cached;
}

/** A hall's heraldry, read as what it is: a `PaletteSeeds` with the hall's name on it. */
function registered(entry: Hall): PaletteView {
  return viewOf(
    { id: entry.id, label: entry.name, ...entry.heraldry },
    { short: entry.short, hall: entry },
  );
}

let registry: PaletteView[] | null = null;

/**
 * The five halls, then Kanzo's own document — derived once per build.
 *
 * Kanzo is last and not first because it is the *before*: the tokens a hall wears until it
 * registers heraldry. It also earns its tab by being the one monochrome pair here — the same grey
 * stands as both seeds, so neither carries a hue — which is the case the fill rule and the
 * true-grey relief are written for, and no hall's heraldry reaches it.
 */
export function heraldry(): PaletteView[] {
  registry ??= [...HALLS.map(registered), shipped(KANZO_ID)];
  return registry;
}
