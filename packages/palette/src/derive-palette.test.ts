import { describe, expect, it } from "vitest";
import paletteData from "../palette-data.json";
import { familyOf, orderScheme } from "./derive-scheme.js";
import {
  CATEGORICAL_LEADING,
  STATUS_SEEDS,
  WHEEL_SPOKES,
  WHEEL_STEP,
  categoricalSource,
  derivePalette,
  neutralSeedFor,
} from "./derive-palette.js";
import {
  CHROMA_FLOOR,
  SURFACE,
  checkScheme,
  contrast,
  hueDistance,
  oklch,
  type Mode,
} from "./palette-check.js";
import {
  SHARED_RAMP_NAMES,
  STATUS_NAMES,
  hashObligations,
  type CrossCheck,
  type Identity,
  type RampSet,
  type TenantPalette,
} from "./palette-document.js";
import { IDENTITY_TOKENS, resolveRoles } from "./roles.js";
import { checkRamp, deriveRamp, toHex, type Ramp } from "./ramp.js";

/**
 * A document is derived once and then trusted for as long as the tenant exists, which is what makes
 * these worth writing: every failure here is a failure nobody would notice. A ramp quietly edited
 * after generation still renders. A neutral that lost its tint still renders — as grey, on 90% of
 * the pixels. A cross-check that grades a status fill against the wrong page still produces a
 * number, and the number is 3.5 instead of 3.06.
 */

const MODES = ["light", "dark"] as const;
const at = "2026-07-29T00:00:00.000Z";

/** A tenant with one brand — the common case, and every fixture below but `BANK`. */
const solo = (id: string, label: string, brand: string, neutral?: string) =>
  derivePalette({ id, label, identities: [{ id, label, brand }], neutral, derivedAt: at });

/** A violet brand, and the fixture most of these read: nine spokes, one subset, ~1.5 s. */
const ACME = solo("acme", "Acme", "#7f22fe");
/** Violet-300: too pale to be a fill, so its ramp has to move and say so. Same family as ACME,
 * different hue — so a *different* wheel, which is the property an even wheel would not have. */
const PALE = solo("pale", "Pale", "#c4b5fd");
/** A grey brand — no hue to carry anywhere. */
const GREY = solo("grey", "Grey", "#737373");
/** Both seeds given, the way a client actually supplies them. */
const SEEDED = solo("seeded", "Seeded", "#2b7fff", "#6b7280");
const ALL = [ACME, PALE, GREY, SEEDED];

/**
 * A multi-brand tenant: a bank's retail blue, its private purple, and a lighter sibling of it.
 *
 * The motivating case, and it is held at module scope because it costs three categorical searches —
 * `deriveSchemeColors` is 0.2–7.4 s per brand and this file already pays for four. The third brand
 * is deliberately in the *same family* as the second: two identities that agree on nearly every
 * value are what a value-diff would silently collapse, and several claims below are about the shape
 * surviving that.
 *
 * The brands are chosen on their measured search cost — ~0.8 s each, against 1.6 s for `ACME` — and
 * on clearing every gate against this neutral, which not every pale brand does: `#c4b5fd` on
 * `#6b7280` lands at 2.995 for `--primary` and `--ring` in light. That is a real property of those
 * two seeds and predates identities entirely; a document with them as its only pair fails the same
 * three rows.
 */
const BANK = derivePalette({
  id: "bank",
  label: "Bank",
  neutral: "#6b7280",
  identities: [
    { id: "retail", label: "Retail", brand: "#2b7fff" },
    { id: "private", label: "Private Bank", brand: "#9810fa" },
    { id: "pale", label: "Pale", brand: "#ad46ff" },
  ],
  // Deliberately not `identities[0]`: the default is a *named* choice, and a derivation that
  // quietly used the first one would pass every test that only ever names the first one.
  defaultIdentity: "private",
  derivedAt: at,
});

/** The identity `:root` carries. */
const primary = (doc: TenantPalette) =>
  doc.identities.find((identity) => identity.id === doc.defaultIdentity) as Identity;

/** The six ramps a resolution needs — the document's five, plus the identity's brand. */
const rampsFor = (doc: TenantPalette, identity: Identity): RampSet => ({
  ...doc.ramps,
  brand: identity.ramp,
});

/** Every cross-check the document holds, wherever it was filed. v2's list, for a single identity. */
const allChecks = (doc: TenantPalette): CrossCheck[] => [
  ...doc.record.crossChecks,
  ...doc.identities.flatMap((identity) => identity.record.crossChecks),
];

/** Sortable, so two lists of the same rows in different orders can be compared as sets. */
const key = (check: CrossCheck) => `${check.mode}/${check.id}/${check.token}/${check.against}`;

/** The status fills a categorical set is asked to stay clear of — what `derivePalette` avoids. */
const AVOID = [
  ...new Set(
    STATUS_NAMES.flatMap((name) => MODES.map((mode) => deriveRamp(STATUS_SEEDS[name], mode).steps[8] as string)),
  ),
];

describe("the ramps a document stores", () => {
  it("are exactly what deriveRamp returned, never post-edited", () => {
    // The document's central claim. A ramp carries its own `relief`, and `relief` is a statement
    // about *those twelve hexes* — touch one afterwards and the statement is a lie that nothing in
    // the system contradicts. Re-measuring off the stored values, with no access to the floats they
    // came from, is the only thing that can catch it.
    // Every identity's brand ramp too, and that is not a formality: a document now stores N+10
    // ramps rather than twelve, and the N that moved are the ones a client actually chose.
    for (const doc of [...ALL, BANK]) {
      const ramps: [string, Record<Mode, Ramp>][] = [
        ...SHARED_RAMP_NAMES.map((name): [string, Record<Mode, Ramp>] => [name, doc.ramps[name]]),
        ...doc.identities.map((identity): [string, Record<Mode, Ramp>] => [
          `brand/${identity.id}`,
          identity.ramp,
        ]),
      ];
      for (const [name, pair] of ramps) {
        for (const mode of MODES) {
          const ramp = pair[mode];
          expect(checkRamp(ramp.steps, mode, ramp.onSolid, ramp.alpha), `${doc.id} ${name} ${mode}`).toEqual(
            ramp.relief,
          );
        }
      }
    }
  });

  it("take no relief but the one a neutral is supposed to take", () => {
    // `carries-identity` on the neutral is not a defect, it is the definition of a neutral: a tint
    // sits five to ten times under the chroma floor on purpose. Anything else in this list means a
    // seed produced a ramp that fails an obligation, which is the sweep `ramp.test.ts` runs and this
    // is its per-document counterpart.
    for (const doc of ALL) {
      const relief = [...doc.record.relief, ...doc.identities.flatMap((it) => it.record.relief)];
      const unexpected = relief.filter(
        (item) => !(item.id === "carries-identity" && (item.ramp === "neutral" || doc.id === "grey")),
      );
      expect(unexpected.map((r) => `${r.ramp}/${r.mode}/${r.id}`), doc.id).toEqual([]);
    }
  });

  it("resolve to the roles the document stored", () => {
    // The stored values and the table have to be the same answer. If they part, `compile` emits one
    // thing and every panel that explains a token by joining on `ROLES` describes another.
    for (const doc of ALL) {
      const identity = primary(doc);
      for (const mode of MODES) {
        const fresh = Object.fromEntries(
          resolveRoles(rampsFor(doc, identity), identity.categorical, mode).map((role) => [
            role.token,
            role.value,
          ]),
        );
        expect(fresh, `${doc.id} ${mode}`).toEqual(doc.roles[mode]);
      }
    }
  });
});

describe("the neutral seed", () => {
  it("keeps a client's tint all the way into the page", () => {
    // The requirement the whole neutral ramp exists for, and the one that was blocked: `deriveRamp`
    // used to zero hue and chroma together below the chroma floor, so `#6b7280` (c 0.0234) came back
    // as `hue: null` and a pure grey. The three-regime fix in `ramp.ts` — noise flattens, a tint
    // keeps its hue and takes relief, an identity keeps everything — is what makes this pass, so if
    // it ever regresses, this is the test that says the product stopped reading as a colour where
    // most of its pixels are.
    expect(SEEDED.seeds.neutralHue).toBeCloseTo(oklch("#6b7280").h, 1);
    expect(SEEDED.seeds.neutralHueFrom).toBe("neutral-seed");
    for (const mode of MODES) {
      const page = SEEDED.roles[mode]["--background"] as string;
      expect(page, mode).not.toBe(SURFACE[mode]);
      expect(oklch(page).c, `${mode} page lost its tint`).toBeGreaterThan(0);
      // And it is a tint, not a colour: still far below the floor at which a hue does identity work.
      expect(oklch(page).c, mode).toBeLessThan(CHROMA_FLOOR);
    }
  });

  it("carries the brand hue over when the client gives no neutral", () => {
    // Two seeds are asked for and one usually arrives. Falling back to grey would throw away the
    // only thing that makes the surfaces the client's; falling back to the *brand hue* at a measured
    // tint chroma keeps it, and every number in the constructed seed is traceable — the lightness is
    // Kanzo's neutral swatch, the chroma is Radix's five tinted greys averaged, the hue is theirs.
    expect(ACME.seeds.neutralHueFrom).toBe("brand");
    // Within the ramp's own 3° hue tolerance, not to the digit: the constructed seed is written as
    // an 8-bit hex at c 0.0136, and angular error goes as one channel level divided by the chroma,
    // so a tint quantises to 1.8° off where a saturated colour would land under a degree. That is
    // the same effect `checkRamp` grades as a perpendicular offset in a/b — ΔE 0.06 at this chroma —
    // rather than as an angle, and for the same reason.
    expect(hueDistance(ACME.seeds.neutralHue as number, oklch("#7f22fe").h)).toBeLessThan(3);
    expect(oklch(ACME.seeds.neutral).c).toBeLessThan(CHROMA_FLOOR);
    expect(neutralSeedFor("#7f22fe")).toBe(ACME.seeds.neutral);
  });

  it("says there is no hue rather than inventing one", () => {
    // A grey brand has an angle that is float error in a/b. The nearest chromatic colour is a hue
    // *we* would be choosing, which is manufacturing brand out of grey — the one thing this layer
    // refuses. So the page really is the surface, and the document says so in a field.
    expect(GREY.seeds.neutralHueFrom).toBe("none");
    expect(GREY.seeds.neutralHue).toBeNull();
    for (const mode of MODES) expect(GREY.roles[mode]["--background"], mode).toBe(SURFACE[mode]);
  });
});

describe("what the seeds gave up", () => {
  it("tags every move with the ramp and the mode it happened in", () => {
    // A ramp's own `adjustments` says "step 9 moved". A document has twelve ramps, so without the
    // tag an onboarding screen can show a client that something moved and not which colour.
    const moved = primary(PALE).record;
    expect(moved.adjustments.length).toBeGreaterThan(0);
    for (const move of moved.adjustments) {
      expect(MODES).toContain(move.mode);
      expect(move.reason.length).toBeGreaterThan(40);
      expect(move.hue, `${move.ramp} rotated the hue`).toBeLessThan(1);
    }
    // Only the brand moved: the status seeds are already legal in both modes, and a client who is
    // told "we adjusted four of your colours" when they supplied one stops reading the screen. It is
    // also why the split is mechanical — every row here already carried the tag it is filed by.
    expect([...new Set(moved.adjustments.map((m) => m.ramp))]).toEqual(["brand"]);
    expect(PALE.record.adjustments).toEqual([]);
    for (const mode of MODES) {
      const chain = moved.adjustments.filter((m) => m.mode === mode);
      expect(chain[chain.length - 1]?.to, mode).toBe(primary(PALE).ramp[mode].steps[8]);
    }
  });

  it("says nothing when nothing moved", () => {
    // A record that always has something in it is noise. `#7f22fe` is already a legal fill in both
    // modes, so the honest answer is an empty list.
    expect(ACME.record.adjustments).toEqual([]);
    expect(primary(ACME).record.adjustments).toEqual([]);
  });
});

describe("the cross-checks", () => {
  const gates = (doc: TenantPalette) => allChecks(doc).filter((c) => c.kind === "gate");

  it("passes every hard gate for every seed tried", () => {
    for (const doc of [...ALL, BANK]) {
      expect(
        gates(doc)
          .filter((c) => !c.ok)
          .map((c) => `${c.mode} ${c.token} on ${c.against}: ${c.got.toFixed(2)} < ${c.wanted}`),
        doc.id,
      ).toEqual([]);
    }
  });

  it("measures against the tenant's page and not the ramp's own", () => {
    // The reason these exist at all. A ramp grades every obligation against its **own** step 1 — the
    // surface carrying a trace of that ramp's hue — so a warning fill clearing 3:1 on a faintly
    // orange page has not been measured on the page it lands on. The two are different numbers, and
    // the second is the one a user experiences.
    for (const mode of MODES) {
      const check = gates(ACME).find((c) => c.mode === mode && c.token === "--warning");
      const ramp = ACME.ramps.warning[mode];
      const own = contrast(ramp.steps[8] as string, ramp.steps[0] as string);
      expect(check?.got, mode).toBeCloseTo(
        contrast(ramp.steps[8] as string, ACME.roles[mode]["--background"] as string),
        6,
      );
      expect(check?.got, `${mode} grading against the ramp's own page`).not.toBe(own);
    }
  });

  it("reaches a verdict that moves per tenant on an input that does not", () => {
    // "Constant input, per-tenant verdict", as an assertion. The syntax roles are Kanzo's and a
    // client's brand does not repaint keywords — but AA is measured against the page, and the page
    // is the tenant's neutral. Same hex, two tenants, two ratios.
    const of = (doc: TenantPalette) =>
      doc.record.crossChecks.find(
        (c) => c.mode === "light" && c.token === "--kanzo-syntax-comment",
      ) as { got: number };
    expect(ACME.roles.light["--kanzo-syntax-comment"]).toBe(
      SEEDED.roles.light["--kanzo-syntax-comment"],
    );
    expect(of(ACME).got).not.toBe(of(SEEDED).got);
  });

  it("is measuring something, not restating a bar", () => {
    // A gate every tenant clears by ten points is paperwork. Measured across these four seeds the
    // tightest hard gate lands within 0.1 of its bar — `--warning` at 3.06–3.07 on a light page,
    // `--kanzo-syntax-comment` at 4.53–4.55 against 4.5, `--ring` on a dark popover at 3.12 — so the
    // margin is real and a slightly different neutral would move it across.
    const margins = ALL.flatMap((doc) => gates(doc).map((c) => c.got - c.wanted));
    expect(Math.min(...margins)).toBeLessThan(0.2);
    expect(Math.min(...margins)).toBeGreaterThanOrEqual(0);
  });

  it("separates a documented relax from a failure", () => {
    // A chart slot under 3:1 obliges the chart around it to carry a relief channel — direct labels,
    // a table view — because a mark is not text. Folding that into the same verdict as a failed AA
    // gate would make a panel report a legal palette as broken, which is precisely the reading
    // `SchemeReport.relief` already exists to prevent.
    const kinds = new Set(allChecks(ACME).map((c) => c.kind));
    expect(kinds).toEqual(new Set(["gate", "relief"]));
    for (const check of allChecks(ACME).filter((c) => c.kind === "relief")) {
      expect(check.token).toMatch(/^--chart-\d$/);
    }
  });

  it("files a row with the token it grades, never with the token it grades against", () => {
    // The partition rule, both directions, because only one of them is obvious. Every row in the
    // whole list measures something against `--background` or `--popover`, and both of those are
    // shared — so grading by the *against* side would file all 26 on the document and an identity
    // block would carry values nothing had ever measured. What varies with the brand is the
    // left-hand side, and `IDENTITY_TOKENS` is the same table `compile` emits from, so a token that
    // drifted out of one list would drift out of both together.
    for (const doc of [...ALL, BANK]) {
      expect(
        doc.record.crossChecks.filter((c) => IDENTITY_TOKENS.includes(c.token)).map(key),
        `${doc.id} shared`,
      ).toEqual([]);
      for (const identity of doc.identities) {
        expect(
          identity.record.crossChecks.filter((c) => !IDENTITY_TOKENS.includes(c.token)).map(key),
          `${doc.id}/${identity.id}`,
        ).toEqual([]);
      }
    }
  });

  it("splits v2's list without losing or duplicating a row", () => {
    // What the split owes: the union is the measurement a single-identity document always made.
    // Enumerated here from the same sources the derivation reads rather than copied from it — four
    // status fills, four status texts, the neutral outline, thirteen syntax roles, the brand fill,
    // the ring on the page and on a popover, and one row per chart slot the set can name.
    const wanted = MODES.flatMap((mode) => [
      ...STATUS_NAMES.map((name) => `${mode}/fill-on-page/--${name}/--background`),
      ...STATUS_NAMES.map((name) => `${mode}/status-text-on-page/--${name}-foreground/--background`),
      `${mode}/boundary-on-page/--input/--background`,
      ...Object.keys(paletteData.syntaxRoles).map(
        (role) => `${mode}/syntax-on-page/--kanzo-syntax-${role}/--background`,
      ),
      `${mode}/fill-on-page/--primary/--background`,
      `${mode}/boundary-on-page/--ring/--background`,
      `${mode}/boundary-on-elevated/--ring/--popover`,
      ...Array.from(
        { length: primary(ACME).categorical.capacity },
        (_, i) => `${mode}/series-on-page/--chart-${i + 1}/--background`,
      ),
    ]);
    expect(allChecks(ACME).map(key).sort()).toEqual([...wanted].sort());
    // Order is the one thing concatenation cannot give back, and it is worth being plain about:
    // v2 emitted `--primary` first among the five `fill-on-page` rows and its four status siblings
    // straight after, so no arrangement of two lists reproduces that interleave. Nothing reads the
    // record positionally — every consumer branches on `id` — so the claim that matters is that the
    // rows are all there, exactly once each.
    expect(new Set(allChecks(ACME).map(key)).size).toBe(allChecks(ACME).length);
  });
});

describe("the categorical set", () => {
  it("names the same categories in both modes", () => {
    // A series keeps its identity across a mode flip — slot 3 is the same thing in both, or the
    // legend lies. Two arrays of different lengths cannot be one scheme, and two of the same length
    // built from different subsets is worse, because it looks like one.
    for (const doc of ALL) {
      expect(primary(doc).categorical.light, doc.id).toHaveLength(primary(doc).categorical.capacity);
      expect(primary(doc).categorical.dark, doc.id).toHaveLength(primary(doc).categorical.capacity);
      expect(primary(doc).categorical.capacity, doc.id).toBeGreaterThan(1);
    }
  });

  it("accounts for every source colour exactly once", () => {
    // `kept`, `crowded` and `dropped` are what an onboarding screen adds up to explain itself. If
    // they do not sum to the source, some colour vanished with no reason attached.
    for (const doc of ALL) {
      const source = categoricalSource(doc.seeds.brand);
      const { kept, crowded, dropped } = primary(doc).categorical;
      expect(kept.length + crowded.length + dropped.length, doc.id).toBe(source.length);
    }
  });

  it("carries the tenant's own hue family", () => {
    // The requirement the whole document exists for, as one assertion. The source this replaced was
    // "the brand, then Kanzo's eight, deduplicated" — eight families against the brand's one — and
    // the subset search then dropped whichever bought the least separation, which for `#009689` was
    // the teal the client is paying for. A chart with nothing of the client in it.
    for (const doc of ALL) {
      const own = familyOf(doc.seeds.brand);
      if (own === null) continue;
      expect(primary(doc).categorical.kept, doc.id).toContain(own);
      expect(primary(doc).categorical.source.family, doc.id).toBe(own);
      expect(primary(doc).categorical.source.from, doc.id).toBe("brand-wheel");
    }
    // The measured regression itself, both halves of it.
    const teal = solo("teal", "Teal", "#009689");
    const violet = solo("violet", "Violet", "#8e51ff");
    expect(primary(teal).categorical.kept).toContain("teal");
    expect(primary(teal).categorical.light).not.toEqual(primary(violet).categorical.light);
    expect(primary(teal).categorical.dark).not.toEqual(primary(violet).categorical.dark);
  });

  it("does not force the brand into slot 1", () => {
    // Decision 13. The order IS the colour-blindness mechanism, so it is derived and not chosen:
    // `orderScheme` sequences by CVD separation and that wins over identity. The brand is made
    // *present*, never first — so the assertion is that identity did not move the sequence, not that
    // the brand can never lead. Measured over 24 brands one every 15°, slot 1 came back as the
    // brand's own family 3 times, which is the search agreeing rather than being told.
    for (const mode of MODES) {
      // The published order reaches exactly what a fresh `orderScheme` reaches on the same colours:
      // nothing in the document re-sequences them for identity's sake. Compared on the score rather
      // than the array because equal-scoring arrangements exist and which one is found first is a
      // property of the input order, not of the rule.
      const fresh = orderScheme(primary(ACME).categorical[mode], mode, {
        avoid: AVOID,
        leading: CATEGORICAL_LEADING,
      });
      expect(checkScheme(fresh, { mode }).cvd.delta, mode).toBeCloseTo(
        primary(ACME).categorical.separation[mode],
        9,
      );
    }
    // And it is not the case that the brand simply always leads: over these seeds it never does.
    const leads = ALL.filter((doc) => familyOf(doc.seeds.brand) !== null).map(
      (doc) => familyOf(primary(doc).categorical.light[0] as string) === familyOf(doc.seeds.brand),
    );
    expect(leads).not.toContain(true);
  });

  it("spins a wheel off the brand hue rather than reading a scheme", () => {
    // Nine hues a golden angle apart from the brand's own, each snapped to its nearest family. Even
    // spacing would have been the obvious rule and is the one that fails: an evenly spaced wheel is
    // invariant under rotation by its own spacing, so it yields 17 family sets for the whole hue
    // circle and 11.58% of brands in different families collide. Nine golden steps do not close, so
    // the brand's hue survives the snap — 137 sets and 0.33%.
    const source = categoricalSource("#7f22fe");
    const families = source.map(familyOf);
    // Deduplicated by family: two sources in one family are handed identical steps, separation 0.
    expect(new Set(families).size).toBe(families.length);
    expect(families.length).toBeLessThanOrEqual(WHEEL_SPOKES);
    // Spoke zero is the brand's own hue, so a collision is resolved in the brand's favour.
    expect(families[0]).toBe(familyOf("#7f22fe"));
    // Every other spoke is that hue plus a published multiple of the golden angle.
    for (let i = 1; i < source.length; i++) {
      const spoke = families.indexOf(families[i] as string);
      expect(spoke).toBe(i);
    }
    expect(WHEEL_STEP).toBeCloseTo(137.507764, 6);
    // Two brands one spoke apart are the case an even wheel cannot tell apart at all.
    const a = categoricalSource("#7f22fe");
    const b = categoricalSource(toHex(oklch("#7f22fe").l, oklch("#7f22fe").c, oklch("#7f22fe").h + 40));
    expect(a.map(familyOf).sort()).not.toEqual(b.map(familyOf).sort());
  });

  it("says so rather than inventing a hue when the brand has none", () => {
    // A brand below the chroma floor has no hue to spin a wheel from, and manufacturing one is what
    // this layer refuses everywhere else. So the source is Kanzo's own scheme — a real answer, not a
    // failure — and the document records which of the two it got, because a panel that could not
    // tell them apart would show a grey-branded tenant the same "your colour is in your charts" line
    // as everyone else.
    expect(primary(GREY).categorical.source).toEqual({
      from: "default-scheme",
      hue: null,
      family: null,
      spokes: 0,
    });
    expect(categoricalSource("#737373")).toEqual(categoricalSource("#525252"));
    expect(primary(GREY).categorical.capacity).toBeGreaterThan(1);
  });

  it("reports how many leading slots it actually held clear", () => {
    // `leading` is an ask, not a guarantee — `orderScheme` degrades rather than refusing. Measured
    // over 24 brand hues with all four status fills avoided it averages 1.04 in light and 1.08 in
    // dark against an ask of 4, and publishing that is the difference between an informed panel and
    // a silent one.
    for (const doc of ALL) {
      for (const mode of MODES) {
        expect(primary(doc).categorical.leading[mode as Mode], `${doc.id} ${mode}`).toBeGreaterThanOrEqual(0);
        expect(primary(doc).categorical.leading[mode as Mode], `${doc.id} ${mode}`).toBeLessThanOrEqual(
          primary(doc).categorical.capacity,
        );
      }
    }
  });
});

describe("the status families", () => {
  it("stay Kanzo's, whoever the tenant is", () => {
    // A state must mean the same thing in every tenant, so a client's brand does not get to repaint
    // "this failed". What is per-tenant is the verdict, which lives in the cross-checks.
    for (const doc of ALL) {
      expect(doc.seeds.status, doc.id).toEqual(STATUS_SEEDS);
      for (const name of STATUS_NAMES) {
        expect(doc.roles.light[`--${name}`], `${doc.id} ${name}`).toBe(
          ACME.roles.light[`--${name}`],
        );
      }
    }
  });

  it("re-derives them rather than copying the shipped hex", () => {
    // The seeds are `-600` and the ramp still owns the outcome: step 9 is the seed pulled away from
    // the surface until it reads as a shape. If they were copied straight through, a future change
    // to `visible-fill` would leave the status fills behind.
    for (const name of STATUS_NAMES) {
      const ramp = deriveRamp(STATUS_SEEDS[name], "light");
      expect(ACME.ramps[name].light.steps, name).toEqual(ramp.steps);
    }
  });
});

describe("derivation as a whole", () => {
  it("is reproducible from the same input", () => {
    // The document is the artefact a client approved. If two derivations of the same seeds disagreed
    // there would be nothing to approve — the stored copy would be a snapshot of a machine.
    expect(solo("acme", "Acme", "#7f22fe")).toEqual(ACME);
  });

  it("stamps the engine that produced it", () => {
    expect(ACME.engine.obligations).toBe(hashObligations());
    expect(ACME.state).toBe("draft");
    expect(
      derivePalette({
        id: "x",
        label: "X",
        identities: [{ id: "x", label: "X", brand: "#737373" }],
        state: "published",
        derivedAt: at,
      }).state,
    ).toBe("published");
  });
});

describe("the identities a tenant publishes", () => {
  it("stores the default identity's tokens as a subset of the map it also stores", () => {
    // The one place this schema duplicates rather than moves, so it is the one place that can drift.
    // `doc.roles` is the whole map — what `:root` emits and what a runtime applies with no assembly
    // — and the default identity's copy is the 15 tokens a scoped block would carry. Key for key,
    // value for value, and strictly smaller: if the two ever part, `compile` writes one palette into
    // `:root` and a panel explains a different one from the same document.
    for (const doc of [...ALL, BANK]) {
      const identity = primary(doc);
      for (const mode of MODES) {
        const subset = identity.roles[mode];
        expect(Object.keys(subset).sort(), `${doc.id} ${mode}`).toEqual([...IDENTITY_TOKENS].sort());
        for (const [token, value] of Object.entries(subset)) {
          expect(value, `${doc.id} ${mode} ${token}`).toBe(doc.roles[mode][token]);
        }
        expect(Object.keys(subset).length).toBeLessThan(Object.keys(doc.roles[mode]).length);
      }
    }
  });

  it("varies nothing outside the identity token set", () => {
    // The claim the whole split rests on, measured against real values rather than declared. Two
    // brands on one neutral produce two full role maps, and everything they disagree about has to be
    // something `compile` actually scopes — otherwise a `[data-identity]` block would be a promise
    // the sheet cannot keep, and the difference would show up as one component quietly wearing the
    // default brand's colour.
    const scoped = new Set([...IDENTITY_TOKENS, "--chart-capacity"]);
    const of = (identity: Identity, mode: Mode) =>
      Object.fromEntries(
        resolveRoles(rampsFor(BANK, identity), identity.categorical, mode).map((role) => [
          role.token,
          role.value,
        ]),
      );
    for (const identity of BANK.identities.filter((it) => it.id !== BANK.defaultIdentity)) {
      for (const mode of MODES) {
        const mine = of(identity, mode);
        const theirs = of(primary(BANK), mode);
        const differ = Object.keys(mine).filter((token) => mine[token] !== theirs[token]);
        expect(differ.filter((token) => !scoped.has(token)), `${identity.id} ${mode}`).toEqual([]);
        // And it is not vacuous: two different brands do differ somewhere.
        expect(differ.length, `${identity.id} ${mode}`).toBeGreaterThan(0);
      }
    }
  });

  it("stores five ramps and one brand per identity, and nothing twice", () => {
    // The move, as a shape. A `ramps.brand` beside `identities[…].ramp` would be the default
    // identity's brand written down twice, and the copy nobody updates is the one a panel reads.
    expect(Object.keys(BANK.ramps).sort()).toEqual([...SHARED_RAMP_NAMES].sort());
    for (const identity of BANK.identities) {
      for (const mode of MODES) {
        expect(identity.ramp[mode].steps, `${identity.id} ${mode}`).toEqual(
          deriveRamp(identity.brand, mode).steps,
        );
      }
    }
    // `seeds.brand` is the *default* identity's, and it is the seed the neutral would have been
    // tinted from had the client given none — which is precisely why a multi-brand tenant may not.
    expect(BANK.seeds.brand).toBe(primary(BANK).brand);
    expect(BANK.seeds.neutralHueFrom).toBe("neutral-seed");
    // Order is the client's — a panel lists identities in it — and the default is a separate fact:
    // `identities[0]` is only it when nothing says otherwise, which is what this fixture disproves.
    expect(BANK.identities.map((it) => it.id)).toEqual(["retail", "private", "pale"]);
    expect(BANK.defaultIdentity).toBe("private");
    expect(BANK.roles.light["--primary"]).toBe(primary(BANK).roles.light["--primary"]);
  });

  it("refuses to carry one brand's hue into a neutral several brands share", () => {
    // The neutral is 90% of the pixels. Deriving it from `identities[0]` would tint the whole
    // product with the retail blue and then paint the private purple on top of it — a decision the
    // client never made, taken silently, in the field where it is hardest to see. One identity keeps
    // the carry-over untouched, which is what `ACME` above already asserts.
    expect(() =>
      derivePalette({
        id: "bank",
        label: "Bank",
        identities: [
          { id: "retail", label: "Retail", brand: "#2b7fff" },
          { id: "private", label: "Private", brand: "#7f22fe" },
        ],
        derivedAt: at,
      }),
    ).toThrow(/explicit neutral seed/);
    expect(ACME.seeds.neutralHueFrom).toBe("brand");
  });

  it("refuses an id it could not write into a selector", () => {
    // `compile` interpolates the id into `[data-identity="…"]` and does no escaping, which is what
    // keeps it a string join. A document that cannot be compiled should not be derivable, so the
    // refusal is here rather than three layers downstream at the point the sheet is written.
    for (const id of ["Retail", "retail brand", "-retail", 'x"]{}', ""]) {
      expect(() =>
        derivePalette({
          id: "bank",
          label: "Bank",
          identities: [{ id, label: "Retail", brand: "#2b7fff" }],
          derivedAt: at,
        }),
        id,
      ).toThrow(/attribute selector/);
    }
  });

  it("refuses a default that names nothing, and two identities that name the same thing", () => {
    // `defaultIdentity` is what `:root` carries and what a retired preference falls back to. A value
    // nothing resolves would compile a sheet with no `:root` capacity and no fallback at all.
    expect(() =>
      derivePalette({
        id: "bank",
        label: "Bank",
        identities: [{ id: "retail", label: "Retail", brand: "#2b7fff" }],
        defaultIdentity: "private",
        derivedAt: at,
      }),
    ).toThrow(/names no identity/);
    expect(() =>
      derivePalette({
        id: "bank",
        label: "Bank",
        neutral: "#6b7280",
        identities: [
          { id: "retail", label: "Retail", brand: "#2b7fff" },
          { id: "retail", label: "Retail again", brand: "#7f22fe" },
        ],
        derivedAt: at,
      }),
    ).toThrow(/share the id/);
  });
});
