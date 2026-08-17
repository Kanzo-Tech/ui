import { describe, expect, it } from "vitest";
import { STATUS_SEEDS, derivePalette } from "./derive-palette.js";
import { PALETTE_SEEDS, seedInput } from "./seeds.js";
import { STATUS_NAMES, type Identity, type TenantPalette } from "./palette-document.js";
import { CONTRAST_MIN, TEXT_MIN, contrast, type Mode } from "./palette-check.js";
import { paletteData } from "./index.js";

/**
 * The identities this package ships, and what survives running them through the real derivation.
 *
 * **There is one shape here now.** A base16 palette is not a palette — it is a brand hue and a
 * neutral hue that goes through `derivePalette` exactly as a client's does. So what these check is
 * no longer "did we transcribe an authored strip correctly and does its `[data-palette]` block
 * agree with it": it is that the seeds are honest about where they came from and that every
 * identity survives derivation.
 *
 * The default tenant's committed document and the sheet compiled from it are `@kanzo-tech/theme`'s
 * artefacts, and are checked there.
 */

/** Pinned so a derivation is a pure function of its seeds — nothing below measures the stamp. */
const DERIVED_AT = "2026-07-29T00:00:00.000Z";

const MODES: Mode[] = ["light", "dark"];
const SOURCES = Object.entries(paletteData.palettes) as [string, { label: string; slots: Record<string, string> }][];
const NEUTRAL_RAMP = ["base00", "base01", "base02", "base03", "base04", "base05"];

/** Every shipped identity, derived. ~3 s in total, and the thing every claim below is about. */
const DERIVED = Object.entries(PALETTE_SEEDS).map(
  ([id, seeds]) => [id, derivePalette({ ...seedInput(id, seeds), derivedAt: DERIVED_AT })] as const,
);

/** A record is split between the document and its identities, so a sweep has to read both halves. */
const checksOf = (doc: TenantPalette) => [
  ...doc.record.crossChecks,
  ...doc.identities.flatMap((identity) => identity.record.crossChecks),
];
const reliefOf = (doc: TenantPalette) => [
  ...doc.record.relief,
  ...doc.identities.flatMap((identity) => identity.record.relief),
];

describe("the base16 sources", () => {
  // They are no longer palettes. Two things still read them — the 13 Kanzo-fixed syntax roles, and
  // the docs showcase that puts an authored original beside its derived result — and both need the
  // strip to be a faithful transcription, which is the one category of value no type can defend.

  it("fills every slot it declares with real hex", () => {
    for (const [name, source] of SOURCES) {
      for (const [slot, hex] of Object.entries(source.slots)) {
        expect(hex, `${name}.${slot}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it("runs base00→base05 monotonically, from its own background to its own ink", () => {
    // base16 orders the base ramp, and both surviving consumers lean on that order: base03 is
    // the mid-tone this package takes as a base seed, and base04/base05 are punctuation and
    // operator ink. A source transcribed out of order would still render — just wrongly, and
    // quietly. The direction is read off the strip rather than declared: a palette whose base00 is
    // darker than its base05 is dark, and that used to be a field.
    for (const [name, source] of SOURCES) {
      const lums = NEUTRAL_RAMP.map((slot) => contrast(source.slots[slot] as string, "#000000"));
      const light = (lums[0] as number) > (lums[5] as number);
      const sorted = [...lums].sort((a, b) => (light ? b - a : a - b));
      expect(lums, `${name} base ramp is not monotone`).toEqual(sorted);
    }
  });

  it("maps all thirteen syntax roles onto slots the Kanzo pair actually declares", () => {
    // `roles.ts` reads exactly these two, one per mode, and a missing slot would resolve to
    // `undefined` in the compiled sheet — a syntax colour that silently falls through to
    // `--foreground`, which is the near-monochrome JSON this mapping was introduced to fix.
    const roles = Object.entries(paletteData.syntaxRoles);
    expect(roles).toHaveLength(13);
    for (const palette of ["kanzo", "kanzo-dark"]) {
      const slots = paletteData.palettes[palette as keyof typeof paletteData.palettes].slots as Record<string, string>;
      for (const [role, slot] of roles) {
        expect(slots[slot], `${palette} has no ${slot} for role "${role}"`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});

describe("the seeds", () => {
  it("takes its neutral from base03, by the rule and not by transcription", () => {
    // The neutral is 90% of the pixels and its tint is nearly invisible in a swatch, so where it
    // came from has to be checkable. base16 orders base00–base05 background → ink, which makes
    // base03 the mid-tone of the source's own base ramp.
    for (const [id, seeds] of Object.entries(PALETTE_SEEDS)) {
      expect(seeds.base, id).toBe(paletteData.palettes[id as keyof typeof paletteData.palettes].slots.base03);
    }
  });

  it("takes its brand from a colour its own source publishes", () => {
    // The one value a ramp cannot infer, so it is the one that could quietly become ours. Every
    // brand here is a slot of the identity it belongs to — Nord's nord8, Dracula's pink, Catppuccin
    // mauve — and Kanzo's is its own base, because this system has no chromatic brand.
    for (const [id, seeds] of Object.entries(PALETTE_SEEDS)) {
      const slots = Object.values(paletteData.palettes[id as keyof typeof paletteData.palettes].slots as Record<string, string>);
      expect(slots, `${id} invents its brand`).toContain(seeds.brand);
    }
  });

  it("keeps the four status seeds the system publishes", () => {
    // Two spellings of one fact is the shape that rots: `statusInk` is what a measurement can be
    // taken against, `STATUS_SEEDS` is what a ramp is grown from. This is where `text-white` sat at
    // 2.13:1 on the warning fill with nothing to compare it to.
    for (const name of STATUS_NAMES) {
      expect(STATUS_SEEDS[name], name).toBe(paletteData.statusInk.light[name].fill);
    }
  });
});

describe("every shipped identity, derived", () => {
  it("survives derivation in both modes, with a categorical set that can name something", () => {
    for (const [id, doc] of DERIVED) {
      // Every shipped seed pair is one identity, so its categorical set is `identities[0]`'s. A
      // document has no set of its own any more: the chart wheel is spun from a brand hue, and which
      // brand that is, is exactly what an identity says.
      const only = doc.identities[0] as Identity;
      expect(doc.identities, id).toHaveLength(1);
      // A document either names categories or **says** it does not. The bar is not "capacity is
      // positive" any more, because one shipped document declines the categorical channel outright
      // — and the whole reason `source.from` carries `declined` is that a zero which is a decision
      // and a zero which is damage are otherwise the same number. So: read the declaration, then
      // hold each answer to its own shape.
      if (only.categorical.source.from === "declined") {
        expect(only.categorical.capacity, `${id} declines and still names something`).toBe(0);
        expect(only.categorical.light, id).toEqual([]);
        expect(only.categorical.dark, id).toEqual([]);
        // Ungraded, not perfect and not zero — there is no pair to be worst.
        for (const mode of MODES) expect(only.categorical.separation[mode], `${id} ${mode}`).toBeNull();
      } else {
        expect(only.categorical.capacity, `${id} can name no categories`).toBeGreaterThan(0);
      }
      expect(only.categorical.light.length, id).toBe(only.categorical.dark.length);
      for (const mode of MODES) expect(Object.keys(doc.roles[mode]).length, `${id} ${mode}`).toBeGreaterThan(50);
    }
  });

  it("passes every hard gate on its own page", () => {
    // `relief` is a documented relax — a chart mark can buy contrast back with direct labels — and
    // `gate` is not. A borrowed identity that could not clear the gates would be one this package
    // should not be offering as a seed pair at all.
    for (const [id, doc] of DERIVED) {
      const failed = checksOf(doc).filter((c) => c.kind === "gate" && !c.ok);
      expect(failed.map((c) => `${id} ${c.mode} ${c.token}: ${c.got.toFixed(2)} < ${c.wanted}`)).toEqual([]);
    }
  });

  it("takes no relief but the one a tinted seed is supposed to take", () => {
    // `carries-identity` fires on every tinted neutral by design, and on Nord's brand too — seven
    // of its eight accents sit below the chroma floor, so Nord has hues to look like and none to
    // chart with. It is the one obligation that can never become an adjustment. Anything else is a
    // ramp that gave up something nobody asked it to.
    for (const [id, doc] of DERIVED) {
      const unexpected = reliefOf(doc).filter((r) => r.id !== "carries-identity");
      expect(unexpected.map((r) => `${id} ${r.ramp}/${r.mode}: ${r.id}`)).toEqual([]);
    }
  });

  it("keeps every status fill on step 9, because a state is not an identity", () => {
    // The scope line for the monochrome-brand rule, measured rather than assumed. `--primary` moves
    // to the ink when its ramp has no hue at all; the status fills stay written as `(X, 9)` and the
    // reason that is safe is here — the four seeds are Kanzo's and chromatic by construction, so the
    // condition they would need to meet can never fire. A red that went near-black would stop
    // reading as a state at all.
    for (const [id, doc] of DERIVED) {
      for (const mode of MODES) {
        for (const name of STATUS_NAMES) {
          const ramp = doc.ramps[name][mode];
          expect(ramp.hue, `${id} ${mode} ${name}`).not.toBeNull();
          expect(ramp.relief.map((r) => r.id), `${id} ${mode} ${name}`).not.toContain("carries-identity");
          expect(doc.roles[mode][`--${name}`], `${id} ${mode} ${name}`).toBe(ramp.steps[8]);
        }
      }
    }
  });

  it("carries AA ink on every status fill, in both modes", () => {
    // The guard that did not exist, and its absence is the whole story: on-fill text was a literal
    // `text-white` in `status.tsx` and `button.tsx` — the one sanctioned exception to token-backed
    // utilities — and it was failing AA on every variant, worst at 2.13:1 on the warning fill. No
    // token meant no measurement, and no measurement meant no failing test. The ink is
    // `Ramp.onSolid` now — whatever measures highest, with no "prefer white when legal" escape —
    // so this is measured per tenant rather than declared once.
    for (const [id, doc] of DERIVED) {
      for (const mode of MODES) {
        for (const name of STATUS_NAMES) {
          const fill = doc.roles[mode][`--${name}`] as string;
          const ink = doc.roles[mode][`--${name}-content`] as string;
          expect(contrast(fill, ink), `${id} ${mode} ${name} on-fill ink`).toBeGreaterThanOrEqual(TEXT_MIN);
        }
      }
    }
  });

  it("keeps its brand readable, which is a bar and never a declared relief", () => {
    // A borrowed identity may fail somewhere and publish it — but one whose BRAND is unreadable is
    // not usable at all, so this stays a hard bar. A fill is not text, so it owes 3:1 on the page;
    // the ink on it owes AA.
    for (const [id, doc] of DERIVED) {
      for (const mode of MODES) {
        const primary = doc.roles[mode]["--primary"] as string;
        expect(contrast(primary, doc.roles[mode]["--background"] as string), `${id} ${mode} brand on page`)
          .toBeGreaterThanOrEqual(CONTRAST_MIN);
        expect(contrast(primary, doc.roles[mode]["--primary-foreground"] as string), `${id} ${mode} brand ink`)
          .toBeGreaterThanOrEqual(TEXT_MIN);
      }
    }
  });
});
