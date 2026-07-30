import {
  BASE16_SLOTS,
  KANZO_ID,
  PALETTE_SEEDS,
  RAMP_NAMES,
  compile,
  derivePalette,
  fillStep,
  seedInput,
  type RampName,
  type TaggedAdjustment,
  type TaggedRelief,
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

export interface PaletteView {
  id: string;
  label: string;
  /** Tab-width name — a hall's short form, since `The Lanternwood Compact` is not a tab. */
  short: string;
  /** The hall whose heraldry this is. Null for Kanzo's own document, which belongs to no hall. */
  hall: Hall | null;
  brandSeed: string;
  neutralSeed: string;
  neutralHue: number | null;
  neutralHueFrom: string;
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
    separation: { light: number; dark: number };
  };
  /** The sixteen authored base16 slots, when this seed pair was lifted from one. */
  authored: {
    label: string;
    slots: [slot: string, hex: string][];
    /** Which slot each seed was taken from, matched rather than transcribed. */
    brandSlot: string | null;
    neutralSlot: string | null;
  } | null;
  css: string;
  ms: number;
}

function authoredFor(id: string, brand: string, neutral: string): PaletteView["authored"] {
  const source = BASE16_SLOTS[id];
  if (!source) return null;
  const slots = Object.entries(source.slots);
  const slotOf = (hex: string) =>
    slots.find(([, value]) => value.toLowerCase() === hex.toLowerCase())?.[0] ?? null;
  return {
    label: source.label,
    slots,
    brandSlot: slotOf(brand),
    neutralSlot: slotOf(neutral),
  };
}

function view(
  id: string,
  seeds: { label: string; brand: string; neutral: string },
  { short, hall }: { short: string; hall: Hall | null },
): PaletteView {
  const started = performance.now();
  const doc = derivePalette(seedInput(id, seeds));
  const ms = Math.round(performance.now() - started);

  return {
    id,
    label: doc.label,
    short,
    hall,
    brandSeed: doc.seeds.brand,
    neutralSeed: doc.seeds.neutral,
    neutralHue: doc.seeds.neutralHue,
    neutralHueFrom: doc.seeds.neutralHueFrom,
    // The library's own rule, not a re-derivation of it: 9 normally, 12 for a brand ramp that
    // reports `carries-identity`. That difference is the whole of the monochrome case.
    fillStep: fillStep(doc.ramps.brand),
    primary: { light: doc.roles.light["--primary"] ?? "", dark: doc.roles.dark["--primary"] ?? "" },
    ramps: RAMP_NAMES.map((name) => ({
      name,
      seed: doc.ramps[name].light.seed,
      hue: doc.ramps[name].light.hue,
      light: doc.ramps[name].light.steps,
      dark: doc.ramps[name].dark.steps,
      boundary: { light: doc.ramps[name].light.boundary, dark: doc.ramps[name].dark.boundary },
      onSolid: { light: doc.ramps[name].light.onSolid, dark: doc.ramps[name].dark.onSolid },
    })),
    adjustments: doc.record.adjustments,
    relief: doc.record.relief,
    categorical: {
      from: doc.categorical.source.from,
      family: doc.categorical.source.family,
      capacity: doc.categorical.capacity,
      families: doc.categorical.families,
      kept: doc.categorical.kept,
      crowded: doc.categorical.crowded,
      dropped: doc.categorical.dropped,
      light: doc.categorical.light,
      dark: doc.categorical.dark,
      separation: doc.categorical.separation,
    },
    authored: authoredFor(id, seeds.brand, seeds.neutral),
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
  const cached = memo.get(id) ?? view(id, seeds, { short: seeds.label, hall: null });
  memo.set(id, cached);
  return cached;
}

/** A hall's heraldry, read as what it is: a `PaletteSeeds` with the hall's name on it. */
function registered(entry: Hall): PaletteView {
  return view(
    entry.id,
    { label: entry.name, ...entry.heraldry },
    { short: entry.short, hall: entry },
  );
}

let registry: PaletteView[] | null = null;
let shippedSet: PaletteView[] | null = null;

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

/**
 * The shipped seed pairs, derived once per build — the base16 showcase's set, not the world's.
 *
 * Deliberately still `PALETTE_SEEDS`: Dracula, Nord and the Catppuccins are the *package's*
 * borrowed identities, and the claim that page makes is about the derivation digesting a foreign
 * palette. A guild hall cannot make that claim, because its heraldry was never a base16 strip.
 */
export function palettes(): PaletteView[] {
  shippedSet ??= Object.keys(PALETTE_SEEDS).map(shipped);
  return shippedSet;
}
