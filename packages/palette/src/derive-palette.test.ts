import { describe, expect, it } from "vitest";
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
import { RAMP_NAMES, STATUS_NAMES, hashObligations } from "./palette-document.js";
import { resolveRoles } from "./roles.js";
import { checkRamp, deriveRamp, toHex } from "./ramp.js";

/**
 * A document is derived once and then trusted for as long as the tenant exists, which is what makes
 * these worth writing: every failure here is a failure nobody would notice. A ramp quietly edited
 * after generation still renders. A neutral that lost its tint still renders — as grey, on 90% of
 * the pixels. A cross-check that grades a status fill against the wrong page still produces a
 * number, and the number is 3.5 instead of 3.06.
 */

const MODES = ["light", "dark"] as const;
const at = "2026-07-29T00:00:00.000Z";

/** A violet brand, and the fixture most of these read: nine spokes, one subset, ~1.5 s. */
const ACME = derivePalette({ id: "acme", label: "Acme", brand: "#7f22fe", derivedAt: at });
/** Violet-300: too pale to be a fill, so its ramp has to move and say so. Same family as ACME,
 * different hue — so a *different* wheel, which is the property an even wheel would not have. */
const PALE = derivePalette({ id: "pale", label: "Pale", brand: "#c4b5fd", derivedAt: at });
/** A grey brand — no hue to carry anywhere. */
const GREY = derivePalette({ id: "grey", label: "Grey", brand: "#737373", derivedAt: at });
/** Both seeds given, the way a client actually supplies them. */
const SEEDED = derivePalette({
  id: "seeded",
  label: "Seeded",
  brand: "#2b7fff",
  neutral: "#6b7280",
  derivedAt: at,
});
const ALL = [ACME, PALE, GREY, SEEDED];

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
    for (const doc of ALL) {
      for (const name of RAMP_NAMES) {
        for (const mode of MODES) {
          const ramp = doc.ramps[name][mode];
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
      const unexpected = doc.record.relief.filter(
        (item) => !(item.id === "carries-identity" && (item.ramp === "neutral" || doc.id === "grey")),
      );
      expect(unexpected.map((r) => `${r.ramp}/${r.mode}/${r.id}`), doc.id).toEqual([]);
    }
  });

  it("resolve to the roles the document stored", () => {
    // The stored values and the table have to be the same answer. If they part, `compile` emits one
    // thing and every panel that explains a token by joining on `ROLES` describes another.
    for (const doc of ALL) {
      for (const mode of MODES) {
        const fresh = Object.fromEntries(
          resolveRoles(doc.ramps, doc.categorical, mode).map((role) => [role.token, role.value]),
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
    expect(PALE.record.adjustments.length).toBeGreaterThan(0);
    for (const move of PALE.record.adjustments) {
      expect(RAMP_NAMES).toContain(move.ramp);
      expect(MODES).toContain(move.mode);
      expect(move.reason.length).toBeGreaterThan(40);
      expect(move.hue, `${move.ramp} rotated the hue`).toBeLessThan(1);
    }
    // Only the brand moved: the status seeds are already legal in both modes, and a client who is
    // told "we adjusted four of your colours" when they supplied one stops reading the screen.
    expect([...new Set(PALE.record.adjustments.map((m) => m.ramp))]).toEqual(["brand"]);
    for (const mode of MODES) {
      const chain = PALE.record.adjustments.filter((m) => m.mode === mode);
      expect(chain[chain.length - 1]?.to, mode).toBe(PALE.ramps.brand[mode].steps[8]);
    }
  });

  it("says nothing when nothing moved", () => {
    // A record that always has something in it is noise. `#7f22fe` is already a legal fill in both
    // modes, so the honest answer is an empty list.
    expect(ACME.record.adjustments).toEqual([]);
  });
});

describe("the cross-checks", () => {
  const gates = (doc: (typeof ALL)[number]) => doc.record.crossChecks.filter((c) => c.kind === "gate");

  it("passes every hard gate for every seed tried", () => {
    for (const doc of ALL) {
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
    const of = (doc: (typeof ALL)[number]) =>
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
    const kinds = new Set(ACME.record.crossChecks.map((c) => c.kind));
    expect(kinds).toEqual(new Set(["gate", "relief"]));
    for (const check of ACME.record.crossChecks.filter((c) => c.kind === "relief")) {
      expect(check.token).toMatch(/^--chart-\d$/);
    }
  });
});

describe("the categorical set", () => {
  it("names the same categories in both modes", () => {
    // A series keeps its identity across a mode flip — slot 3 is the same thing in both, or the
    // legend lies. Two arrays of different lengths cannot be one scheme, and two of the same length
    // built from different subsets is worse, because it looks like one.
    for (const doc of ALL) {
      expect(doc.categorical.light, doc.id).toHaveLength(doc.categorical.capacity);
      expect(doc.categorical.dark, doc.id).toHaveLength(doc.categorical.capacity);
      expect(doc.categorical.capacity, doc.id).toBeGreaterThan(1);
    }
  });

  it("accounts for every source colour exactly once", () => {
    // `kept`, `crowded` and `dropped` are what an onboarding screen adds up to explain itself. If
    // they do not sum to the source, some colour vanished with no reason attached.
    for (const doc of ALL) {
      const source = categoricalSource(doc.seeds.brand);
      const { kept, crowded, dropped } = doc.categorical;
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
      expect(doc.categorical.kept, doc.id).toContain(own);
      expect(doc.categorical.source.family, doc.id).toBe(own);
      expect(doc.categorical.source.from, doc.id).toBe("brand-wheel");
    }
    // The measured regression itself, both halves of it.
    const teal = derivePalette({ id: "teal", label: "Teal", brand: "#009689", derivedAt: at });
    const violet = derivePalette({ id: "violet", label: "Violet", brand: "#8e51ff", derivedAt: at });
    expect(teal.categorical.kept).toContain("teal");
    expect(teal.categorical.light).not.toEqual(violet.categorical.light);
    expect(teal.categorical.dark).not.toEqual(violet.categorical.dark);
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
      const fresh = orderScheme(ACME.categorical[mode], mode, {
        avoid: AVOID,
        leading: CATEGORICAL_LEADING,
      });
      expect(checkScheme(fresh, { mode }).cvd.delta, mode).toBeCloseTo(
        ACME.categorical.separation[mode],
        9,
      );
    }
    // And it is not the case that the brand simply always leads: over these seeds it never does.
    const leads = ALL.filter((doc) => familyOf(doc.seeds.brand) !== null).map(
      (doc) => familyOf(doc.categorical.light[0] as string) === familyOf(doc.seeds.brand),
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
    expect(GREY.categorical.source).toEqual({
      from: "default-scheme",
      hue: null,
      family: null,
      spokes: 0,
    });
    expect(categoricalSource("#737373")).toEqual(categoricalSource("#525252"));
    expect(GREY.categorical.capacity).toBeGreaterThan(1);
  });

  it("reports how many leading slots it actually held clear", () => {
    // `leading` is an ask, not a guarantee — `orderScheme` degrades rather than refusing. Measured
    // over 24 brand hues with all four status fills avoided it averages 1.04 in light and 1.08 in
    // dark against an ask of 4, and publishing that is the difference between an informed panel and
    // a silent one.
    for (const doc of ALL) {
      for (const mode of MODES) {
        expect(doc.categorical.leading[mode as Mode], `${doc.id} ${mode}`).toBeGreaterThanOrEqual(0);
        expect(doc.categorical.leading[mode as Mode], `${doc.id} ${mode}`).toBeLessThanOrEqual(
          doc.categorical.capacity,
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
    expect(derivePalette({ id: "acme", label: "Acme", brand: "#7f22fe", derivedAt: at })).toEqual(ACME);
  });

  it("stamps the engine that produced it", () => {
    expect(ACME.engine.obligations).toBe(hashObligations());
    expect(ACME.state).toBe("draft");
    expect(derivePalette({ ...{ id: "x", label: "X", brand: "#737373" }, state: "published", derivedAt: at }).state)
      .toBe("published");
  });
});
