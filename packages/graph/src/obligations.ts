import type { Channels } from "./graph-model";
import { lookFrom, SHAPE, SHAPE_ORDER, SHAPE_OTHER, type Look } from "./graph-looks";

/**
 * What the graph's geometry owes, as a report rather than as prose.
 *
 * This is `@kanzo-tech/palette`'s `OBLIGATIONS` one section along, and the shape is deliberately the
 * same family: a stable `id` a caller can branch on, and a `reason` that is one line a panel can
 * show. What is added is the part that makes an obligation checkable instead of quotable — the
 * number, the bar, and what the number was measured against.
 *
 * **Why this file exists.** The colour section publishes twenty-one obligations and the graph
 * section published none, while having four that were perfectly real and living in comments. That
 * asymmetry made "are these two the same kind of thing?" an argument. With both sections reporting,
 * it is an observation. See `decisions/a-section-brings-measurable-obligations.md`.
 *
 * **What `OBLIGATIONS` does not do.** It grades constants of ours — the shape scale and the three
 * shipped forms — so it cannot fail at runtime for a consumer; it is the section's own claim about
 * itself, checked in CI. `gradeComposition` is the half that *can* fail for a consumer, because
 * what it grades is what the caller composed.
 */
export interface Obligation {
  /** Stable key, so a caller branches on the failure rather than parsing prose. */
  id: string;
  /** What the number is a property of. */
  subject: string;
  /** The measured value, in `unit`. `null` means the obligation is real and not yet gradeable. */
  measured: number | null;
  /** The bar `measured` must clear, in `unit`. `null` where `measured` is. */
  threshold: number | null;
  /** How `measured` must stand to `threshold`. */
  holds: ">=" | "<=" | "<";
  unit: string;
  /** What the bar comes from — an external system, a standard, or a measurement of ours. */
  against: string;
  /** The rule in one line. */
  reason: string;
}

/** How many of the ordered shapes `SHAPE_OTHER` collides with. Must be none. */
const otherCollisions = SHAPE_ORDER.filter((s) => s === SHAPE_OTHER).length;

/** The largest curvature any look asks for. */
// One curvature now, not three: the `bowed-links` toggle picks it or zero, so the largest a form
// can ask for is what the toggle turns on. Read through `lookFrom` rather than typed here, which is
// what keeps this a measurement of the shipped value instead of a copy of it.
const maxCurve = lookFrom({ "bowed-links": "true" }).link.curve;

/**
 * The floor a **composition** owes, not a look — and that move is the point rather than a detail.
 *
 * Graded against the three shipped looks it could not fail for a consumer: it read *the smallest
 * radius among looks that encode identity as shape*, and after
 * `decisions/a-look-is-form-and-a-channel-is-a-binding.md` there are no such looks, because a look
 * no longer encodes anything. Graded against a composition it covers strictly more — it catches a
 * host pairing `symbol` with a dense form's ramp, which is a picture nobody can read and which
 * nothing previously reported.
 *
 * `gradeComposition` below is the function this file always said it was waiting for: *a `Look` is
 * not user-authored today; when one is, this is the function that has to run against it.* The
 * binding got there first.
 */
const SHAPE_FLOOR: Omit<Obligation, "measured"> = {
  id: "shape-floor",
  subject: "the smallest point radius of a form that `symbol` is bound on",
  threshold: 4,
  holds: ">=",
  unit: "px",
  against:
    "the size at which shape starts corrupting the size and luminance channels beside it — " +
    "Giovannangeli et al. (arXiv 2103.06084) on dual-attribute encoding, and Smart & Szafir " +
    "(CHI 2019, doi:10.1145/3290605.3300899) for the JND and size-bias figures",
  reason:
    "The floor protects the OTHER channels from shape, not shape from smallness. Binding `symbol` " +
    "and `r` together spends shape on identity AND size on degree at once, which Giovannangeli " +
    "measures as dropping performance drastically under even minor heterogeneity; and smaller " +
    "marks worsen it both ways — the luminance JND rises from 6.48 ΔL* at 50px to 11.30 at 6px, " +
    "and a square is reported larger than any other shape at equal area in 82% of trials, so the " +
    "size ramp that carries meaning reads wrong. It binds only where shape is spent: a composition " +
    "spending COLOUR on identity is right to start at 2, because a 2px dot still carries a hue and " +
    "has no second channel to interfere with. NOT 'shapes collapse at small sizes' — Smart & " +
    "Szafir measured 16 shapes across 6 sizes and found discrimination robust to size, varying " +
    "significantly only at 6px and by 4.5 accuracy points.",
};

/**
 * Grade what a host actually composed: this form, with these bindings.
 *
 * `null` when `symbol` is not bound, which is not a pass — there is no obligation to grade, because
 * a point wearing one glyph has no second channel to protect.
 */
export function gradeComposition(look: Look, channels: Channels): Check | null {
  if (channels.symbol === undefined) return null;
  const measured = look.size[0];
  const threshold = SHAPE_FLOOR.threshold as number;
  return { ...SHAPE_FLOOR, measured, threshold, ok: measured >= threshold };
}

export const OBLIGATIONS: readonly Obligation[] = [
  {
    id: "shape-capacity",
    subject: "distinguishable glyphs the scale can name, including the past-capacity one",
    measured: SHAPE_ORDER.length + 1,
    threshold: 5,
    holds: "<=",
    unit: "glyphs",
    against:
      "the measured capacity ceiling of the shape channel — 5, against 7 for colour " +
      "(Giovannangeli et al., arXiv 2103.06084)",
    reason:
      "Naming more categories than the channel can carry claims a difference nobody can see, which " +
      "is the same mistake `categoricalCapacity` exists to stop colour making. The two scales have " +
      "different cardinalities because the CHANNELS do, not because one is drawn smaller: four " +
      "ordered slots plus SHAPE_OTHER is exactly the five the literature allows, and the colour " +
      "side agrees from the other end — Dracula's document publishes a capacity of 7. cosmos.gl " +
      "would draw nine, and nine is the number this bar exists to refuse.",
  },
  {
    id: "shape-other",
    subject: "ordered shapes that collide with the past-capacity glyph",
    measured: otherCollisions,
    threshold: 0,
    holds: "<=",
    unit: "collisions",
    against: "`SHAPE_ORDER`, the four slots a real category can wear",
    reason:
      "A fifth category must say *not one of the four* rather than repeat the first one, so " +
      "`SHAPE_OTHER` may not be a member of the order — the fallback used to be `circle`, which is " +
      "category 0's glyph. It also may not be cosmos.gl's `None` (8): the point fragment shader " +
      "`discard`s a NONE point carrying no image, so 'past capacity' spelled that way deletes the " +
      "node from the picture, and a category nobody can name is still a node with edges.",
  },
  {
    id: "link-curve",
    subject: "the largest curvature any look asks for",
    measured: maxCurve,
    threshold: 0.5,
    holds: "<",
    unit: "fraction of link length",
    against: "cosmos.gl's own default curvature",
    reason:
      "Every link bows the same way, so at the renderer's default a few hundred of them read as " +
      "one pinwheel — motion where there is structure. A hint is enough to separate a parallel " +
      "pair, which is the only thing the curve is for.",
  },
  {
    id: "link-fade",
    subject: "the screen length past which a link stops being drawn",
    measured: null,
    threshold: null,
    holds: ">=",
    unit: "screen px",
    against: "not yet established — see below",
    reason:
      "Real and not gradeable yet, and saying so is better than inventing a bar. cosmos.gl measures " +
      "this in SCREEN pixels rather than graph space, so a range that reads well at one zoom can " +
      "erase the whole edge layer at another, which surfaces as 'Show links stopped working'. The " +
      "three shipped looks keep far ends of 1200–1500 against near ends of 180–220. What would " +
      "close it: the renderer's exact fade semantics — which end of the range hides a link, and " +
      "whether length is measured before or after the camera transform — and then a bar expressed " +
      "against the canvas diagonal rather than a constant, because that is the only length that " +
      "scales with the surface the graph is drawn on.",
  },
];

/** An obligation that can be graded, and whether it holds. */
export interface Check extends Obligation {
  measured: number;
  threshold: number;
  ok: boolean;
}

/**
 * Grade every obligation that carries a number.
 *
 * Ungradeable rows are skipped rather than defaulted to passing: a bar nobody has established
 * cannot be cleared, and reporting one as green is how a guard comes to test a corpus of zero.
 * `OBLIGATIONS.length - check().length` is the number of open questions this section has.
 */
export function check(): Check[] {
  return OBLIGATIONS.filter(
    (o): o is Obligation & { measured: number; threshold: number } =>
      o.measured !== null && o.threshold !== null,
  ).map((o) => ({
    ...o,
    ok:
      o.holds === ">="
        ? o.measured >= o.threshold
        : o.holds === "<="
          ? o.measured <= o.threshold
          : o.measured < o.threshold,
  }));
}

/** `SHAPE.cross` is the past-capacity glyph and `SHAPE` is re-exported so a caller can name it. */
export { SHAPE };
