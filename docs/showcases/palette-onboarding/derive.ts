import {
  BASE16_SLOTS,
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

/**
 * Every shipped seed pair, run through the real derivation — on the server, at build time.
 *
 * This is the honest place for it. Deriving a document costs 0.2–1.6 s per tenant here (the
 * categorical search dominates), which is fine once at onboarding and unacceptable in a browser;
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

function view(id: string): PaletteView {
  const seeds = PALETTE_SEEDS[id];
  if (!seeds) throw new Error(`no seed pair named ${id}`);

  const started = performance.now();
  const doc = derivePalette(seedInput(id, seeds));
  const ms = Math.round(performance.now() - started);

  return {
    id,
    label: doc.label,
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

let cache: PaletteView[] | null = null;

/** All five shipped seed pairs, derived once per build. */
export function palettes(): PaletteView[] {
  cache ??= Object.keys(PALETTE_SEEDS).map(view);
  return cache;
}
