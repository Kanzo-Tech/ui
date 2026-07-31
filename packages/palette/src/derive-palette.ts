import pkg from "../package.json";
import paletteDataJson from "../palette-data.json";
import { deriveSchemeColors, familyAtHue, familyOf, familyStandard } from "./derive-scheme.js";
import {
  CHROMA_FLOOR,
  CONTRAST_MIN,
  SURFACE,
  TEXT_MIN,
  contrast,
  oklch,
  type Mode,
} from "./palette-check.js";
import {
  PALETTE_SCHEMA_VERSION,
  SHARED_RAMP_NAMES,
  STATUS_NAMES,
  hashObligations,
  type CategoricalSet,
  type CrossCheck,
  type HueSource,
  type Identity,
  type PaletteRecord,
  type PaletteState,
  type RampSet,
  type RoleValues,
  type SharedRampName,
  type SharedRampSet,
  type StatusName,
  type TaggedAdjustment,
  type TaggedRelief,
  type TenantPalette,
} from "./palette-document.js";
import { IDENTITY_TOKENS, ROLES, resolveRoles } from "./roles.js";
import { TINT_FLOOR, TINT_REFERENCE, deriveRamp, toHex, type Ramp } from "./ramp.js";

/**
 * Deriving one tenant's palette document: five shared ramps, a brand ramp and a categorical set per
 * identity, two modes, and a record split the same way.
 *
 * **There is no first-paint budget here.** Runtime only *applies* a stored document, so the maths in
 * this file may be as thorough as quality demands — the categorical search alone measures a median
 * of 1.1 s and 7.5 s at worst over 24 brand hues, and that is the *cheaper* of the two spacings the
 * choice came down to. It is an onboarding-time cost paid once per client, and it buys a search that
 * would be unthinkable on a render path. Do not re-derive a "keep it cheap enough to inline"
 * constraint from the fact that palette *application* is inlined: two different moments.
 *
 * The gate policy throughout is *adjust and publish* — never accept-and-warn, never refuse. A
 * client's brand red at 2.1:1 becomes a legal red of the same hue and `record.adjustments` says so
 * in a sentence a person can read on an onboarding screen.
 */

const MODES = ["light", "dark"] as const;

/**
 * The four status seeds, read from what the system already publishes.
 *
 * All four sit at `-600` rather than Tailwind's `-500`, which is a divergence this package already
 * paid for and measured: red-500 carries neither white (3.81) nor near-black (4.15) at AA, and
 * emerald-500/amber-500 measure 2.37 and 2.05 against the page, so a filled badge was barely visible
 * as a shape. They are Kanzo's and not the client's — a state must mean the same thing in every
 * tenant — but every obligation they carry is re-measured here against *this* tenant's page.
 */
const STATUS_INK = paletteDataJson.statusInk as unknown as Record<
  Mode,
  Record<StatusName, { fill: string; content: string }>
>;

export const STATUS_SEEDS: Record<StatusName, string> = Object.fromEntries(
  STATUS_NAMES.map((name) => [name, STATUS_INK.light[name].fill]),
) as Record<StatusName, string>;

/** Kanzo's neutral base swatch. Supplies a lightness when a client gives no neutral seed. */
const NEUTRAL_SWATCH = paletteDataJson.baseSwatches.neutral;

const DEFAULT_SCHEME = (
  paletteDataJson.schemes as unknown as Record<string, { light: string[] }>
)[paletteDataJson.defaultScheme] as { light: string[] };

/** How many leading chart slots are asked to stay clear of the status fills. */
export const CATEGORICAL_LEADING = 4;

/**
 * The neutral seed, and where its hue came from.
 *
 * The client supplies two seeds, brand and neutral, and the neutral is the one that matters most:
 * it is 90% of the pixels. It is **tinted** — a low chroma at a hue, the way Radix ships mauve,
 * slate, sage, olive and sand beside its pure grey — because a tint that does not survive into the
 * near-white surfaces means the product does not read as a colour where most of it is painted.
 *
 * When no neutral is given, the brand hue is carried over rather than a grey being used, and every
 * number in the constructed seed is traceable: the lightness is Kanzo's own neutral base swatch, the
 * chroma is `TINT_REFERENCE` — the measured mean step 9 of Radix's five tinted greys — and the hue
 * is the brand's. `TINT_REFERENCE.light` specifically, because a seed is one colour for both modes
 * and `tintedChroma` re-scales it per mode anyway; the light figure is the conservative one.
 *
 * A brand below `TINT_FLOOR` has an angle that is float error in a/b rather than a colour, so there
 * is nothing to carry and the answer is the grey itself.
 */
export function neutralSeedFor(brand: string, given?: string): string {
  if (given) return given;
  const { c, h } = oklch(brand);
  if (c < TINT_FLOOR) return NEUTRAL_SWATCH;
  return toHex(oklch(NEUTRAL_SWATCH).l, TINT_REFERENCE.light, h);
}

/**
 * The angle between two spokes of the brand wheel — the golden angle, `180 · (3 − √5)`.
 *
 * **Not `360 / spokes`, and that is the whole difference between a wheel that carries identity and
 * one that only looks like it does.** An evenly spaced wheel is invariant under rotation by its own
 * spacing: a brand at 15° and a brand at 255° are six spokes apart, so they are handed the *same
 * nine angles* and therefore the same nine families. That is not an edge case, it is the structure.
 * Swept over the whole hue circle at 0.01° resolution, an even nine-spoke wheel yields **17 distinct
 * family sets in total**, each shared by seven to twelve different brand families — 11.58% of pairs
 * of brands in different families come back with an identical set. It would have replaced "every
 * tenant gets Kanzo's scheme" with "every tenant gets one of seventeen", which is the same defect
 * with a bigger number.
 *
 * Nine golden-angle steps do not close (9 × 137.51 ≡ 157.6°, not 0), so the wheel is not invariant
 * under any rotation and the brand's hue survives the snap. Same sweep: **137 distinct family sets,
 * and 0.33% of cross-family pairs collide** — a 35× reduction. The golden angle is the published
 * rule for spreading points on a circle when their number is not fixed in advance, which is exactly
 * this problem: the wheel is cut before anyone knows how many families will survive the gates.
 *
 * The residual 0.33% is real and is not claimed away: two brands in different families *can* still
 * snap to the same nine families. What is guaranteed is weaker and is the thing that matters — each
 * one's own family is in its own set (see `require` in `derivePalette`).
 */
export const WHEEL_STEP = 180 * (3 - Math.sqrt(5));

/**
 * How many spokes the wheel is cut into. Nine, chosen on the measured knee and nothing else.
 *
 * The whole hue circle at 0.01°, and 24 brands one every 15° taken all the way through
 * `deriveSchemeColors` with the status fills avoided:
 *
 * | spokes | collide | capacity | worst sep L/D | slots under 3:1 | median / worst search |
 * |---|---|---|---|---|---|
 * | 8 | 1.10% | 6.96 (min 6) | 15.3 / 15.0 | 1.46 | 0.4 s / 1.5 s |
 * | 9 | 0.33% | 7.46 (min 7) | 15.5 / 15.0 | 1.17 | 1.1 s / 7.5 s |
 * | 10 | 0.11% | 7.75 (min 7) | 15.5 / 15.0 | 1.13 | 3.2 s / 27.2 s |
 * | 12 | 0.12% | — | — | — | — |
 *
 * Eight is short: below `MAX_ORDERED` once the wheel self-collides — the 17 family hues are not
 * evenly spaced, widest gap yellow→lime at 61.8° — so the subset search gets no choice at all and
 * capacity drops a whole category. Twelve is past the floor: the collision rate has stopped
 * improving by ten. Between nine and ten the *worst* case is identical on every quality axis
 * (capacity 7, separation 15.5 / 15.0) and only the means move, for 3.3× the search. Nine.
 *
 * Raising it is a one-line change and the table above is what it buys. There is no first-paint
 * budget here — Decision 2 — but there is a test suite, and 27 s per fixture is a different kind of
 * cost from 7 s.
 */
export const WHEEL_SPOKES = 9;

/**
 * The colours the categorical set is derived from: a wheel of hues spun off the tenant's brand.
 *
 * **This is where a client's identity gets into their charts, and the previous answer did not.** The
 * source used to be "the brand, then Kanzo's own eight-colour scheme, deduplicated by family", and
 * over 24 brands one every 15° that produced **six distinct sets** and dropped the brand's own family
 * **ten times**: `#009689` and `#8e51ff` came back byte-identical in light, and for the teal it was
 * the teal that went — a chart with nothing of the client in it, twice over. The scheme dominated
 * because it contributed eight families to the brand's one, and the subset rule then chose on
 * separation alone, which is a quality question that knows nothing about whose palette it is.
 *
 * So the source is now *only* the brand: `WHEEL_SPOKES` hues at `WHEEL_STEP` from each other
 * starting at the brand's own, each snapped to its nearest family. The brand's hue is spoke zero, so
 * the client's own family leads the wheel and every other hue in the chart is that hue plus a
 * published multiple of the golden angle. Deduplicated by family for the same reason as before — two
 * sources in one family are handed the same steps, separation 0, and a set the gates refuse for a
 * reason that was never about the palette — and spoke zero is first, so a collision is resolved in
 * the brand's favour. The wheel therefore names 8.64 families on average and 7 at worst, not always
 * nine; `capacity` is what survived, and it is published.
 *
 * The brand still does **not** get to lead slot 1 (Decision 13). Membership is guaranteed by
 * `require` in `derivePalette`; the sequence stays `orderScheme`'s, which orders by CVD separation.
 * Measured over 24 brands one every 15°, slot 1 came back as the brand's own family 3 times — which
 * is what "not forced" looks like, as against "never", which would be a different rule.
 *
 * **A brand below `CHROMA_FLOOR` has no hue to spin a wheel from**, and this is the one case that is
 * not a wheel: the answer is Kanzo's default scheme, unchanged, and the document says so in
 * `CategoricalSet.source.from`. Manufacturing a hue for a grey brand is the thing this layer refuses
 * everywhere else — `neutralSeedFor` refuses it, `carries-identity` stays relief rather than
 * becoming an adjustment — and a chart is not the place to start.
 */
export function categoricalSource(
  brand: string,
  spokes: number = WHEEL_SPOKES,
  step: number = WHEEL_STEP,
): string[] {
  const { c, h } = oklch(brand);
  if (c < CHROMA_FLOOR) return [...DEFAULT_SCHEME.light];
  const taken = new Set<string>();
  const source: string[] = [];
  for (let i = 0; i < spokes; i++) {
    const family = familyAtHue(h + i * step);
    if (taken.has(family)) continue;
    taken.add(family);
    source.push(familyStandard(family));
  }
  return source;
}

/**
 * One brand a tenant publishes.
 *
 * One shape and no shorthand union. A `brand?: string` beside `identities` would give a tenant with
 * one brand a second way to say the same thing, and every reader downstream — the compiler, the
 * panel, the record splitter — would carry a branch for a case that is already expressible. A
 * single-identity tenant writes a one-element array, which is what it is.
 */
export interface IdentityInput {
  /** `/^[a-z0-9][a-z0-9-]*$/`. Interpolated into a CSS attribute selector — see `ID_SHAPE`. */
  id: string;
  /** The client's own name for this brand. Never formatted by a host. */
  label: string;
  /** The seed. */
  brand: string;
}

export interface DerivePaletteInput {
  /** Stable per tenant — what the server looks the document up by at request time. */
  id: string;
  label: string;
  /** At least one, ids unique. Order is the client's. */
  identities: readonly [IdentityInput, ...IdentityInput[]];
  /** Defaults to the first identity — the one `:root` carries. Must name one of them. */
  defaultIdentity?: string;
  /**
   * The client's neutral.
   *
   * Omitted, it is built from the **default identity's** brand hue — see `neutralSeedFor`. That
   * carry-over is only available to a single-identity tenant; see the throw in `derivePalette`.
   */
  neutral?: string;
  /** Defaults to `draft`: a freshly derived document has not been reviewed yet. */
  state?: PaletteState;
  /** Injectable so a derivation can be reproduced byte for byte. Defaults to now. */
  derivedAt?: string;
}

/**
 * The shape a `data-*` attribute value already takes, and the shape an id has to take here.
 *
 * Validated at derive time rather than escaped at compile time. An id is interpolated into
 * `[data-identity="…"]`, and a document that cannot be compiled should not be derivable in the first
 * place — which is also what keeps `compile` a string join with no escaping rules of its own.
 */
const ID_SHAPE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Seeds in, document out.
 *
 * Two halves. **Once per document**: the neutral seed, the five shared ramps, the status fills a
 * categorical set must stay clear of, and the record rows and cross-checks about all of them.
 * **Once per identity**: a brand ramp pair, a categorical set spun off that brand's hue, the role
 * table resolved against shared + brand, and the record rows about the brand.
 *
 * The order matters once, and it is the reason the halves are in this order rather than the other:
 * every identity's categorical set avoids the *derived* status fills, not the seeds, because a fill
 * is what a reader actually sees and step 9 is the seed pulled away from the surface until it reads
 * as a shape.
 */
export function derivePalette(input: DerivePaletteInput): TenantPalette {
  const identities = input.identities;
  for (const identity of identities) {
    if (!ID_SHAPE.test(identity.id)) {
      throw new Error(
        `identity id "${identity.id}" is not usable in a CSS attribute selector. It has to match ` +
          `${ID_SHAPE.source} — lower case, digits and hyphens, starting with a letter or digit — ` +
          `because compile() interpolates it straight into [data-identity="…"].`,
      );
    }
  }

  const ids = identities.map((identity) => identity.id);
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
  if (duplicate !== undefined) {
    throw new Error(
      `two identities share the id "${duplicate}". They would compile to two blocks with the same ` +
        `selector, and the second would silently win.`,
    );
  }

  const defaultIdentity = input.defaultIdentity ?? (identities[0] as IdentityInput).id;
  const chosen = identities.find((identity) => identity.id === defaultIdentity);
  if (!chosen) {
    throw new Error(
      `defaultIdentity "${defaultIdentity}" names no identity in this document. It is what :root ` +
        `carries and what a retired preference falls back to, so it cannot be a value nothing ` +
        `resolves. Published: ${ids.map((id) => `"${id}"`).join(", ")}.`,
    );
  }

  // The one thing a second identity makes compulsory. `neutralSeedFor` carries a *brand* hue into
  // the neutral when the client gives none — and the neutral is 90% of the pixels, so on a
  // multi-brand tenant that would tint the whole product with one identity's hue and then paint the
  // others on top of it. A tenant with several brands has to choose a neutral that serves all of
  // them, which is the same decision the client already makes, applied to the field where it bites.
  if (identities.length > 1 && !input.neutral) {
    throw new Error(
      `a document with ${identities.length} identities needs an explicit neutral seed. With one ` +
        `identity the brand hue is carried into the neutral, but the neutral is 90% of the pixels ` +
        `and there is no reason "${chosen.brand}" should tint the surfaces the other brands are ` +
        `painted on. Choose a neutral that serves all of them.`,
    );
  }

  const neutral = neutralSeedFor(chosen.brand, input.neutral);
  const sharedSeeds: Record<SharedRampName, string> = { neutral, ...STATUS_SEEDS };
  const ramps = Object.fromEntries(
    SHARED_RAMP_NAMES.map((name) => [
      name,
      Object.fromEntries(MODES.map((mode) => [mode, deriveRamp(sharedSeeds[name], mode)])),
    ]),
  ) as SharedRampSet;

  // Both modes' fills, deduplicated. A series must not read as a state in *either* mode, and the
  // two sets are usually the same colour anyway — a status seed is already in band and already
  // clears 3:1, so step 9 rarely moves. Derived once and handed to every identity: the statuses are
  // the tenant's, so what a chart has to stay clear of does not vary with the brand.
  const avoid = [
    ...new Set(STATUS_NAMES.flatMap((name) => MODES.map((mode) => ramps[name][mode].steps[8] as string))),
  ];

  const derived = identities.map((identity) => deriveIdentity(identity, ramps, avoid));
  const primary = derived.find((it) => it.identity.id === defaultIdentity) as DerivedIdentity;

  const neutralRamp = ramps.neutral.light;
  const neutralHueFrom: HueSource =
    neutralRamp.hue === null ? "none" : input.neutral ? "neutral-seed" : "brand";

  return {
    schemaVersion: PALETTE_SCHEMA_VERSION,
    id: input.id,
    label: input.label,
    state: input.state ?? "draft",
    seeds: {
      brand: chosen.brand,
      neutral,
      neutralHue: neutralRamp.hue,
      neutralHueFrom,
      status: { ...STATUS_SEEDS },
      surfaces: { light: SURFACE.light, dark: SURFACE.dark },
    },
    engine: {
      package: pkg.version,
      obligations: hashObligations(),
      derivedAt: input.derivedAt ?? new Date().toISOString(),
    },
    ramps,
    identities: derived.map((it) => it.identity),
    defaultIdentity,
    roles: primary.roles,
    record: sharedRecordOf(ramps, primary.roles),
  };
}

// ── One identity ────────────────────────────────────────────────────────────────────────────────

/** An `Identity` plus the full role map it resolved to — which only the default identity keeps. */
interface DerivedIdentity {
  identity: Identity;
  roles: Record<Mode, RoleValues>;
}

/**
 * One brand, against the ramps the tenant already has.
 *
 * It resolves the **whole** role table rather than the 15 tokens it will keep, because the shared
 * two-thirds is what the identity's own rows are measured against — a brand fill is graded on the
 * neutral page, not on its own. The caller keeps the full map for the default identity and throws
 * the rest away, which is the only work this repeats per identity that is not a per-identity fact.
 */
function deriveIdentity(
  input: IdentityInput,
  shared: SharedRampSet,
  avoid: readonly string[],
): DerivedIdentity {
  const ramp = Object.fromEntries(
    MODES.map((mode) => [mode, deriveRamp(input.brand, mode)]),
  ) as Record<Mode, Ramp>;
  const ramps: RampSet = { ...shared, brand: ramp };

  // The brand's own family is *required*, not merely offered. The subset search chooses on
  // separation, which is a quality question that has no opinion about whose palette it is, so
  // without this a nine-spoke wheel can drop the one family the tenant is paying for. It constrains
  // membership only — the order stays `orderScheme`'s, per Decision 13. Measured over thirteen
  // brands at nine spokes it changed neither mode's separation (19.3 light / 17.9 dark, with and
  // without), because it only ever binds when the search was about to make exactly that mistake.
  const own = familyOf(input.brand);
  const derived = deriveSchemeColors(categoricalSource(input.brand), {
    avoid: [...avoid],
    leading: CATEGORICAL_LEADING,
    require: own === null ? [] : [own],
  });
  const categorical: CategoricalSet = {
    source: {
      from: own === null ? "default-scheme" : "brand-wheel",
      hue: own === null ? null : oklch(input.brand).h,
      spokes: own === null ? 0 : WHEEL_SPOKES,
      family: own,
    },
    light: derived.light,
    dark: derived.dark,
    capacity: derived.light.length,
    families: derived.families,
    kept: derived.kept,
    crowded: derived.crowded,
    dropped: derived.dropped,
    separation: derived.separation,
    leading: derived.leading,
  };

  const roles = Object.fromEntries(
    MODES.map((mode) => [
      mode,
      Object.fromEntries(resolveRoles(ramps, categorical, mode).map((role) => [role.token, role.value])),
    ]),
  ) as Record<Mode, RoleValues>;

  const adjustments: TaggedAdjustment[] = [];
  const relief: TaggedRelief[] = [];
  for (const mode of MODES) {
    for (const move of ramp[mode].adjustments) adjustments.push({ ...move, ramp: "brand", mode });
    for (const item of ramp[mode].relief) relief.push({ ...item, ramp: "brand", mode });
  }

  return {
    identity: {
      id: input.id,
      label: input.label,
      brand: input.brand,
      ramp,
      categorical,
      roles: Object.fromEntries(
        MODES.map((mode) => [
          mode,
          Object.fromEntries(IDENTITY_TOKENS.map((token) => [token, roles[mode][token] as string])),
        ]),
      ) as Record<Mode, RoleValues>,
      record: {
        adjustments,
        relief,
        crossChecks: MODES.flatMap((mode) => identityCrossChecks(categorical, roles[mode], mode)),
      },
    },
    roles,
  };
}

// ── The record ──────────────────────────────────────────────────────────────────────────────────

/**
 * The document's half — everything that is not about a brand.
 *
 * It reads the *default* identity's resolved values, and that is not an arbitrary pick: every token
 * a shared row grades and every token it grades against is a shared one, so any identity's map would
 * give the same numbers. The default's is the one that is also stored, so the record and
 * `doc.roles` are provably about the same values.
 */
function sharedRecordOf(ramps: SharedRampSet, roles: Record<Mode, RoleValues>): PaletteRecord {
  const adjustments: TaggedAdjustment[] = [];
  const relief: TaggedRelief[] = [];
  for (const ramp of SHARED_RAMP_NAMES) {
    for (const mode of MODES) {
      const it = ramps[ramp][mode];
      for (const move of it.adjustments) adjustments.push({ ...move, ramp, mode });
      for (const item of it.relief) relief.push({ ...item, ramp, mode });
    }
  }
  return {
    adjustments,
    relief,
    crossChecks: MODES.flatMap((mode) => sharedCrossChecks(roles[mode], mode)),
  };
}

const SYNTAX_TOKENS = ROLES.filter(
  (role) => role.binding.kind === "fixed" && role.token.startsWith("--kanzo-syntax-"),
).map((role) => role.token);

/**
 * The measurements that only exist once six ramps share one page.
 *
 * A ramp grades every obligation against its **own** step 1 — the mode's surface carrying a trace of
 * that ramp's own hue. The page a user sees is the **neutral** ramp's step 1, tinted with the
 * tenant's neutral. So a status fill that clears 3:1 on its own faintly-red page has not yet been
 * measured on the page it will actually land on, and nothing inside a single ramp can make that
 * measurement. This is where "constant input, per-tenant verdict" is written down.
 *
 * The margins are thin enough that these are real gates and not paperwork. Measured over seven brand
 * seeds: `--warning` lands at 3.06–3.07 against a bar of 3, `--primary` for an amber brand at 3.01,
 * `--ring` for a violet brand at 3.15, and the worst syntax role — `comment` — at 4.53–4.55 against
 * a bar of 4.5.
 *
 * They report and never adjust. The two things a failure could move are the two that must not: a
 * Kanzo-fixed status or syntax value, and a ramp step that is already the nearest legal value inside
 * its own ramp.
 *
 * **The split follows the token being graded, not the token it is graded against.** Every row here
 * grades something against `--background`, `--popover` or nothing at all — all shared — so the
 * "against" side would put every row on the document. What varies with the brand is the left-hand
 * side, which is why both halves read a *whole* resolved map: an identity row needs the shared page
 * to measure its own fill on. A row is the identity's iff the token it grades is in
 * `IDENTITY_TOKENS`, and `derive-palette.test.ts` asserts exactly that of both lists.
 */
const grader =
  (out: CrossCheck[], values: RoleValues, mode: Mode) =>
  (
    id: string,
    token: string,
    against: string,
    wanted: number,
    reason: string,
    kind: "gate" | "relief" = "gate",
  ) => {
    const got = contrast(values[token] as string, values[against] as string);
    out.push({ id, mode, token, against, kind, wanted, got, ok: got >= wanted, reason });
  };

/** The rows about the four statuses, the neutral outline and the syntax roles. Brand-independent. */
function sharedCrossChecks(values: RoleValues, mode: Mode): CrossCheck[] {
  const out: CrossCheck[] = [];
  const check = grader(out, values, mode);

  for (const name of STATUS_NAMES) {
    check(
      "fill-on-page",
      `--${name}`,
      "--background",
      CONTRAST_MIN,
      "A solid fill must read as a shape against the page the tenant actually renders, which is the " +
        "neutral ramp's step 1 and not this ramp's own.",
    );
  }

  for (const name of STATUS_NAMES) {
    check(
      "status-text-on-page",
      `--${name}-foreground`,
      "--background",
      TEXT_MIN,
      "The readable-on-the-page variant of a status hue is text — error text, an invalid ring, a " +
        "destructive menu item — so it owes WCAG AA on the tenant's page.",
    );
  }

  check(
    "boundary-on-page",
    "--input",
    "--background",
    CONTRAST_MIN,
    "WCAG 1.4.11 asks 3:1 of the visual boundary that identifies an interactive component.",
  );

  for (const token of SYNTAX_TOKENS) {
    check(
      "syntax-on-page",
      token,
      "--background",
      TEXT_MIN,
      "The syntax roles are Kanzo's and a client's brand does not repaint keywords — but AA is " +
        "measured against the page, and the page is the tenant's.",
    );
  }

  return out;
}

/** The rows about one brand — its fill, its ring, and its own chart wheel. */
function identityCrossChecks(
  categorical: CategoricalSet,
  values: RoleValues,
  mode: Mode,
): CrossCheck[] {
  const out: CrossCheck[] = [];
  const check = grader(out, values, mode);

  check(
    "fill-on-page",
    "--primary",
    "--background",
    CONTRAST_MIN,
    "A solid fill must read as a shape against the page the tenant actually renders, which is the " +
      "neutral ramp's step 1 and not this ramp's own.",
  );

  check(
    "boundary-on-page",
    "--ring",
    "--background",
    CONTRAST_MIN,
    "WCAG 1.4.11 asks 3:1 of the visual boundary that identifies an interactive component. " +
      "`--ring` comes from the brand ramp, so on the neutral page this is a new measurement.",
  );

  check(
    "boundary-on-elevated",
    "--ring",
    "--popover",
    CONTRAST_MIN,
    "A focus ring on a raised surface. In dark the popover sits two steps up the neutral ramp, so " +
      "it is a different background from the page and 1.4.11 still applies.",
  );

  for (const role of ROLES) {
    if (role.binding.kind !== "categorical" || role.binding.slot > categorical.capacity) continue;
    check(
      "series-on-page",
      role.token,
      "--background",
      CONTRAST_MIN,
      "A series colour below 3:1 on the page obliges the chart around it to carry a relief channel " +
        "— direct labels, a table view. A mark is not text, so this is a relax and not a failure.",
      "relief",
    );
  }

  return out;
}
