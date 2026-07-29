import themeDataJson from "../theme-data.json";
import {
  BAND,
  CHROMA_FLOOR,
  CONTRAST_MIN,
  CVD_FLOOR,
  NORMAL_FLOOR,
  SURFACE,
  checkScheme,
  contrast,
  deltaE,
  hueDistance,
  oklch,
  type Mode,
  type PairList,
} from "./palette-check.js";

/**
 * Translating a foreign palette into a scheme this system can actually use — the anti-corruption
 * layer, as a pure function.
 *
 * A named palette (Dracula, Nord, a customer's brand sheet) is *not* a categorical scheme, and this
 * is measured rather than assumed: run through `checkScheme`, Dracula puts all seven accents outside
 * the dark lightness band, Nord puts seven of eight below the chroma floor, and Catppuccin Mocha
 * fails both. The cause is structural. A syntax palette optimises text legibility on one background,
 * so its dark flavours are pastel; categorical marks optimise mutual separation at mark scale in two
 * modes, and the dark band forbids exactly that pastel range. **A mark is not text.**
 *
 * So a palette contributes its **hues** and nothing else. Lightness and chroma come from the
 * system's own ramps, and the checks decide. What survives is real — a scheme derived from Dracula
 * has no blue and two greens, which is recognisably not the default — but what is lost is the mood:
 * derived Dracula green is `#008236` where Dracula's own is `#50fa7b`.
 */

const RAMPS = themeDataJson.ramps as unknown as Record<string, Record<string, string>>;

/**
 * The same quantities `checkScheme` measures, indexed by colour and by pair.
 *
 * Every stage below asks the same question about the same handful of colours millions of times: the
 * ordering search evaluates one arrangement per permutation and `allPairsCap` evaluates one more per
 * prefix, while the values themselves only ever come from the ramps. A pair's ΔE cannot change
 * between two of those calls, and the whole six-palette sweep only ever sees a few thousand distinct
 * pairs, so the conversions are the entire cost. Measured over the six base16 palettes in both
 * modes: 9.3 s to 0.68 s, and the eight-family worst case from 3.2 s to 0.23 s, with every returned
 * value identical to the last digit — this package's whole test suite went from ~10 s to under 1 s
 * on the same assertions. It is what makes a two-mode joint search affordable at all.
 *
 * By rights this belongs in `palette-check.ts`, next to the arithmetic it indexes. It is here
 * because the check file is the specification and a cache is not part of a specification — so the
 * two are kept honest from the outside instead, by a test that runs both over the same schemes and
 * demands the same numbers. Divergence would not be silent: the search would optimise a rule the
 * gate no longer applies, while still reporting the gate's own verdict.
 *
 * The thresholds are imported, never restated. Only the composition is repeated, and that is the
 * part the agreement test covers.
 */
const PAIR_CVD = new Map<string, number>();
const PAIR_NORMAL = new Map<string, number>();
const OUTSIDE = new Map<string, boolean>();
const DIM = new Map<string, boolean>();

/** Order-independent, because every quantity keyed on it is symmetric. */
const pairKey = (a: string, b: string) => (a < b ? a + b : b + a);

/**
 * Worst of protanopia and deuteranopia for one pair.
 *
 * `checkScheme` takes the worst pair per kind and then the worse kind; this takes the worse kind per
 * pair and then the worst pair. Same set of numbers, same minimum, no reordering of floats.
 */
const cvdBetween = (a: string, b: string): number => {
  const key = pairKey(a, b);
  let v = PAIR_CVD.get(key);
  if (v === undefined) PAIR_CVD.set(key, (v = Math.min(deltaE(a, b, "protan"), deltaE(a, b, "deutan"))));
  return v;
};

const normalBetween = (a: string, b: string): number => {
  const key = pairKey(a, b);
  let v = PAIR_NORMAL.get(key);
  if (v === undefined) PAIR_NORMAL.set(key, (v = deltaE(a, b)));
  return v;
};

/** Outside the mode's lightness band, or below the chroma floor — the two per-value failures. */
const outside = (hex: string, mode: Mode): boolean => {
  const key = mode + hex;
  let v = OUTSIDE.get(key);
  if (v === undefined) {
    const { l, c } = oklch(hex);
    const [lo, hi] = BAND[mode];
    OUTSIDE.set(key, (v = l < lo || l > hi || c < CHROMA_FLOOR));
  }
  return v;
};

const dim = (hex: string, mode: Mode): boolean => {
  const key = mode + hex;
  let v = DIM.get(key);
  if (v === undefined) DIM.set(key, (v = contrast(hex, SURFACE[mode]) < CONTRAST_MIN));
  return v;
};

interface Verdict {
  cvd: number;
  normal: number;
  relief: number;
  ok: boolean;
}

/**
 * `checkScheme`'s verdict, in the form the searches score on and without the lists they ignore.
 *
 * The `>= 2` guard is not defensive: with fewer colours there are no pairs, both minima stay
 * `Infinity`, and every separation test would pass vacuously — which is how Nord, with exactly one
 * accent above the chroma floor, once reported a passing scheme.
 */
function verdict(colours: readonly string[], mode: Mode, pairs: PairList = "adjacent"): Verdict {
  const n = colours.length;
  let cvd = Number.POSITIVE_INFINITY;
  let normal = Number.POSITIVE_INFINITY;
  let relief = 0;
  let legal = n >= 2;
  for (let i = 0; i < n; i++) {
    const a = colours[i] as string;
    if (outside(a, mode)) legal = false;
    if (dim(a, mode)) relief += 1;
    const to = pairs === "all" ? n : Math.min(n, i + 2);
    for (let j = i + 1; j < to; j++) {
      const b = colours[j] as string;
      const d = cvdBetween(a, b);
      if (d < cvd) cvd = d;
      const e = normalBetween(a, b);
      if (e < normal) normal = e;
    }
  }
  return { cvd, normal, relief, ok: legal && cvd >= CVD_FLOOR && normal >= NORMAL_FLOOR };
}

/** Every family's hue, measured once off its mid step. */
const FAMILY_HUES: [string, number][] = Object.entries(RAMPS).map(([name, steps]) => [
  name,
  oklch(steps["600"] as string).h,
]);

/**
 * The family whose hue is nearest, or `null` for a colour that has no usable hue.
 *
 * Matched on hue and never on `deltaE`: ΔE includes lightness, and a uniformly pastel palette lets
 * lightness dominate the distance — matching Dracula's accents by ΔE answers `purple→sky` and
 * `green→yellow`, which are neighbourhoods of nothing.
 */
export function familyOf(hex: string): string | null {
  const { c, h } = oklch(hex);
  // Below the floor there is no hue to match, only float noise in a/b. Nord loses seven of eight
  // colours here, which is why nothing can be derived from it at all.
  if (c < CHROMA_FLOOR) return null;
  return (FAMILY_HUES.reduce((a, b) => (hueDistance(h, b[1]) < hueDistance(h, a[1]) ? b : a))[0]);
}

export interface Derivation {
  /** The slots, in the order given. Empty when no assignment clears the gates. */
  colours: string[];
  /** The family each slot landed on, for a panel that wants to explain itself. */
  families: string[];
  /** Source colours that carried no usable hue and were dropped. */
  dropped: string[];
}

/** The families a source yields, the colours they came from, and the ones with no usable hue. */
function familiesOf(source: readonly string[]) {
  const dropped: string[] = [];
  const families: string[] = [];
  const usable: string[] = [];
  for (const hex of source) {
    const family = familyOf(hex);
    if (family === null) dropped.push(hex);
    else {
      families.push(family);
      usable.push(hex);
    }
  }
  return { families, dropped, usable };
}

/**
 * Step assignments that clear band and chroma, best-first by the order-independent objective.
 *
 * `keep` exists because the objective here is a *lower bound* — the worst pair over all pairs is
 * what every arrangement is at least worth, not what the best arrangement is actually worth.
 * Ranking by it and then ordering only the leader loses to a runner-up whose colours happen to
 * arrange better, which is measurable: on the default scheme's own families, taking the leader
 * alone landed at CVD ΔE 20.4 where the shipped scheme reaches 20.9. Keeping a shortlist and
 * ordering each recovers it, and is the reason `deriveOrderedScheme` exists at all.
 */
function candidates(families: string[], mode: Mode, keep: number): string[][] {
  if (!families.length) return [];
  const steps = Object.keys(RAMPS[families[0] as string] as Record<string, string>);
  const ranked: { colours: string[]; score: number }[] = [];

  // Every family independently takes any legal step. Small by construction — four steps over the
  // handful of families a palette yields — and exhaustive beats a greedy pass, which can strand
  // itself on a slot whose only legal step ruins its neighbour.
  const walk = (index: number, chosen: string[]) => {
    if (index === families.length) {
      // `all`, not the default `adjacent`: the objective has to be order-independent, because the
      // order does not exist yet. Band and chroma are already enforced per step below, so the only
      // thing left to reject here would be a separation gate this stage cannot honestly apply.
      const report = verdict(chosen, mode, "all");
      const score = Math.min(report.cvd, report.normal / 2) - report.relief;
      ranked.push({ colours: [...chosen], score });
      ranked.sort((a, b) => b.score - a.score);
      ranked.length = Math.min(ranked.length, keep);
      return;
    }
    for (const step of steps) {
      const hex = (RAMPS[families[index] as string] as Record<string, string>)[step] as string;
      const { l, c } = oklch(hex);
      const [lo, hi] = BAND[mode];
      if (l < lo || l > hi || c < CHROMA_FLOOR) continue;
      walk(index + 1, [...chosen, hex]);
    }
  };
  walk(0, []);

  return ranked.map((r) => r.colours);
}

/**
 * Snap a palette's colours onto the system's ramps for one mode.
 *
 * Order is the caller's: this chooses *steps*, not the sequence. What it therefore must not do is
 * judge the result with a gate that depends on the sequence — and it used to. `checkScheme`'s
 * default `adjacent` pair list asks "are neighbours far enough apart?", which is a question about
 * an arrangement this function does not get to make.
 *
 * That was invisible until a base16 palette arrived, because base16 orders its accents around the
 * **hue wheel** — red, orange, yellow, green, cyan, blue, magenta — so every adjacent pair is a hue
 * neighbour, which is the worst sequence there is. Measured: in the dark band no hue-neighbour pair
 * reaches the separation floor at any legal step (amber/yellow tops out at 12.2, red/orange at 14.1,
 * lime/green at 13.3, floor 15). Five of six palettes refused in dark, one in both modes — and the
 * same six colours in a different sequence derived fine. The set was never the problem.
 *
 * So the separation gate moves to where the order is finally known: `orderScheme` chooses the
 * sequence and `checkScheme` returns the verdict. What is left here is the part that genuinely does
 * not depend on order — band and chroma, both properties of a value.
 *
 * **Prefer `deriveOrderedScheme`**, which composes the three stages so a caller cannot get the
 * order of the stages wrong. This one is the step-chooser on its own, and its result has not yet
 * been judged on separation by anything.
 */
export function deriveScheme(source: readonly string[], mode: Mode): Derivation {
  const { families, dropped } = familiesOf(source);
  return { colours: candidates(families, mode, 1)[0] ?? [], families, dropped };
}

/** How many leading slots stay mutually distinct on the all-pairs list — the scatter-form cap. */
export function allPairsCap(colours: readonly string[], mode: Mode): number {
  let n = 2;
  while (n <= colours.length && verdict(colours.slice(0, n), mode, "all").ok) n += 1;
  return n - 1;
}

/** Exhaustive ordering is factorial, and eight slots is already forty thousand arrangements. */
const MAX_ORDERED = 8;

export interface OrderOptions {
  /**
   * Colours the leading slots must stay clear of — the status palette, in practice.
   *
   * Status is reserved so a state never impersonates a series, and the cost of ignoring this is
   * concrete: the unconstrained winner for the default scheme put rose-500 in slot 2, ΔE 3.9 from
   * `--destructive`, on the series almost every chart uses.
   */
  avoid?: readonly string[];
  /** How many leading slots are held to that distance. */
  leading?: number;
}

/**
 * Choose the order the slots are handed out in.
 *
 * The order **is** the colour-blindness safety mechanism, which is why it is derived and not
 * chosen: only neighbouring slots are guaranteed to touch, so an arrangement decides which pairs
 * have to survive simulation. Exhaustive rather than greedy — a greedy pass commits to an opening
 * that strands the worst pair at the end — and factorial, so it is an authoring-time function.
 *
 * Scored on the worst adjacent pair first, because that is the hard gate, then on the all-pairs cap
 * (which the order genuinely moves: for the default scheme, re-ordering took it from 2 leading
 * slots to 5), then on how many slots need contrast relief.
 */
export function orderScheme(
  colours: readonly string[],
  mode: Mode,
  options: OrderOptions = {},
): string[] {
  const { avoid = [], leading = 4 } = options;
  if (colours.length > MAX_ORDERED) {
    throw new RangeError(`orderScheme is exhaustive and refuses ${colours.length} slots`);
  }

  const clashes = (hex: string) => avoid.some((other) => deltaE(hex, other) < NORMAL_FLOOR);

  const free = colours.length - colours.filter(clashes).length;
  /**
   * Lexicographic on the tuple, spelled out.
   *
   * `a > b` on two arrays compares their *string* forms, so `[9, …] > [12, …]` is `"9,…" > "12,…"`
   * — true, and exactly backwards. It happens to agree with intent whenever the leading numbers
   * share a digit count, which is why a wrong comparator here survives a first pass.
   */
  const better = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) {
      if ((a[i] as number) !== (b[i] as number)) return (a[i] as number) > (b[i] as number);
    }
    return false;
  };
  const search = (held: number): string[] => {
    let best: { order: string[]; score: number[] } | null = null;
    const walk = (rest: readonly string[], chosen: string[]) => {
      // `<=`, not `<`: the length is read *after* the push, so `<` never tested the last leading slot.
      if (chosen.length && chosen.length <= held && clashes(chosen[chosen.length - 1] as string)) return;
      if (!rest.length) {
        const report = verdict(chosen, mode);
        if (!report.ok) return;
        const score = [report.cvd, allPairsCap(chosen, mode), -report.relief];
        if (!best || better(score, best.score)) best = { order: [...chosen], score };
        return;
      }
      for (let i = 0; i < rest.length; i++) {
        walk([...rest.slice(0, i), ...rest.slice(i + 1)], [...chosen, rest[i] as string]);
      }
    };
    walk(colours, []);
    return best ? (best as { order: string[] }).order : [];
  };

  /**
   * Ask for as many clear leading slots as possible, then for one fewer, and so on.
   *
   * `avoid` is a preference — keep a status colour out of the slots a chart is most likely to use —
   * while the checks are the law. Treating them as one constraint meant a palette whose fourth-best
   * slot happened to sit near `--destructive` was refused *entirely*, and the refusal was
   * indistinguishable from "these colours cannot be told apart". Measured: `kanzo`, `dracula` and
   * `catppuccin-latte` each ordered fine in both modes with `avoid` dropped, and each returned `[]`
   * with it — the separation gate was never the problem for any of them.
   *
   * Degrading is not the same as ignoring: the first arrangement found is the one that holds the
   * most slots clear, and `deriveOrderedScheme` reports how many that turned out to be, so a
   * scheme that could not keep four says so rather than pretending it did.
   */
  for (let held = Math.min(leading, free); held >= 0; held--) {
    const order = search(held);
    if (order.length) return order;
  }
  return [];
}

/** How many leading slots are actually clear of `avoid` — the ask, after reality. */
export function leadingClear(order: readonly string[], avoid: readonly string[]): number {
  let n = 0;
  while (n < order.length && !avoid.some((o) => deltaE(order[n] as string, o) < NORMAL_FLOOR)) n += 1;
  return n;
}

/**
 * How many step assignments are ordered before one is chosen.
 *
 * Six, because the shortlist is only there to cover the gap between the lower bound the search can
 * see and the value an arrangement actually reaches, and that gap is small. Raising it costs one
 * exhaustive ordering each and bought nothing measurable past this point.
 */
const SHORTLIST = 6;

/**
 * The separation a scheme must still reach before it is allowed one more category.
 *
 * A palette hands over the families it happens to have, and taking all of them saturates the space:
 * measured over the six base16 palettes, forcing every surviving family landed the worst adjacent
 * pair under simulation at 7.2–15.0 — one hundredth above the `CVD_TARGET` pass mark in two cases —
 * where the same palettes reach 17.8–32.1 on a subset. That is the whole trade, and the curve says
 * it is nearly free: for four of the five derivable palettes the drop is a *cliff*, not a slope
 * (kanzo 28.5 → 11.5, catppuccin-latte 32.1 → 9.2, kanzo-dark 19.5 → 7.7, catppuccin-mocha
 * 30.2 → 19.7), so any bar between 12 and 19 picks out the same subset and the exact value is not
 * load-bearing. Dracula is the one that pins it down, because its curve genuinely slopes
 * (17.8, 14.3, 10.1, 7.2): a bar of 20 costs it two categories to buy headroom over a target of 8,
 * a bar of 8 keeps six families at 10.1. 15 splits it at four.
 *
 * Roughly twice `CVD_TARGET`, and within 3.1 ΔE of the 20.9 the shipped scheme reaches at eight
 * slots — against 13.7 below it when every family is forced.
 *
 * A ceiling on categories is not a loss: `Scheme.slots` is already the *capacity* a scheme claims,
 * and the tokens past it fold to the muted "Other". Naming five real categories and saying so beats
 * naming seven that a colour-blind reader sees as five.
 */
export const SEPARATION_BAR = 15;

export interface DeriveOptions extends OrderOptions {
  /**
   * The bar a subset must clear before another family is admitted. Defaults to `SEPARATION_BAR`.
   *
   * Degrades rather than refuses, in the same way `avoid` does: if no subset at any size clears it,
   * the largest one that merely passes the checks is returned and `separation` reports what it
   * actually reached, so a panel can say "this palette only manages 9.2" instead of saying nothing.
   */
  separation?: number;
}

export interface OrderedDerivation extends Derivation {
  /** The slots in the order they are handed out, or empty when nothing can be arranged. */
  ordered: string[];
  /**
   * How many leading slots ended up clear of the avoided colours.
   *
   * Reported rather than assumed, because `orderScheme` degrades: it asks for as many as it was
   * told and settles for what the colours allow. Below the ask, the slots past this point can be
   * mistaken for a status colour, which matters most on the early series a chart actually uses.
   */
  leading: number;
  /** The family behind each entry of `colours` — the subset of `families` that made the scheme. */
  kept: string[];
  /**
   * Source colours left out because the scheme could not stay separable with them in it.
   *
   * Deliberately *not* folded into `dropped`. They are different facts and a panel that conflates
   * them tells the user something false: `dropped` means "this colour carries no hue at all, there
   * was nothing to use", while this means "its hue was fine, but the palette already spends that
   * part of the wheel". The first is a property of the colour, the second of the company it keeps —
   * and only the second changes if the user removes some other colour.
   */
  crowded: string[];
  /** The worst adjacent pair under simulation that the returned arrangement reaches. */
  separation: number;
}

/** Index subsets of a given size, in the source's own order. */
function* combinations(n: number, k: number): Generator<number[]> {
  const idx = Array.from({ length: k }, (_, i) => i);
  if (k > n) return;
  for (;;) {
    yield [...idx];
    let i = k - 1;
    while (i >= 0 && (idx[i] as number) === n - k + i) i -= 1;
    if (i < 0) return;
    idx[i] = (idx[i] as number) + 1;
    for (let j = i + 1; j < k; j++) idx[j] = (idx[j - 1] as number) + 1;
  }
}

interface Arrangement {
  /** The chosen steps, in the step-chooser's order. */
  colours: string[];
  /** The same colours, sequenced. */
  ordered: string[];
  /** The worst adjacent pair under simulation the sequence reaches. */
  delta: number;
}

/**
 * The best arrangement one family subset can reach in one mode, or `null` if it cannot be arranged.
 *
 * The shortlist is the whole reason this is a loop rather than a call: `candidates` ranks on a lower
 * bound over all pairs, which is what every arrangement is at least worth, not what the best one is
 * actually worth. Ordering only the leader loses to a runner-up whose colours happen to sequence
 * better — measured at 20.4 against the shipped scheme's 20.9 on its own families.
 */
function bestArrangement(
  names: readonly string[],
  mode: Mode,
  options: DeriveOptions,
): Arrangement | null {
  let best: Arrangement | null = null;
  for (const colours of candidates([...names], mode, SHORTLIST)) {
    const ordered = orderScheme(colours, mode, options);
    if (!ordered.length) continue;
    const delta = verdict(ordered, mode).cvd;
    if (!best || delta > best.delta) best = { colours, ordered, delta };
  }
  return best;
}

/**
 * The whole anti-corruption layer, composed correctly: choose steps, choose the order, then judge.
 *
 * This exists because composing it by hand is how it went wrong. `deriveScheme` cannot apply the
 * separation gate — that gate asks about neighbours, and it does not choose the neighbours — so a
 * caller who ran `deriveScheme` and trusted the result was trusting a judgement that had not been
 * made. Worse, the earlier version *did* apply it, in the caller's order, which silently made the
 * answer depend on the sequence the palette happened to be written in. A base16 palette is written
 * in hue-wheel order, so five of six refused in dark for no reason but their spelling.
 *
 * Order matters twice over, so it is decided once, here, and the verdict is taken after it.
 *
 * It also decides **how many** categories to name, which is the fourth stage and the one that used
 * to be skipped. Every surviving family was forced into the scheme, on the assumption that a family
 * the palette owns is a category the palette can express — and that is not true past a point that
 * the palette itself does not know. See `SEPARATION_BAR` for the measurement; the families left
 * over come back as `crowded`, never as `dropped`.
 *
 * Subsets are searched largest-first and the first size that clears the bar wins, so the usual case
 * — a palette whose families all fit — costs one pass and no more than the previous version did.
 * Measured over the six base16 palettes with the pair index above in place: 0 ms to 242 ms to an
 * answer, and 233 ms for the worst case there is at eight families, a descent all the way to two.
 * (Before the index the same sweep was 9 ms to 3.2 s, and that worst case 5.9 s — the figures the
 * shape of this search was originally judged on.) A source with more usable families than
 * `MAX_ORDERED` no longer throws — the descent simply starts there, which is the one thing
 * subsetting buys for free — but C(n, 8) grows fast: nine families measured 1.5 s, twelve would
 * still be minutes.
 */
export function deriveOrderedScheme(
  source: readonly string[],
  mode: Mode,
  options: DeriveOptions = {},
): OrderedDerivation {
  const { families, dropped, usable } = familiesOf(source);
  const { separation = SEPARATION_BAR } = options;

  type Pick = Arrangement & { picked: number[] };
  const bestOf = (picked: number[]): Pick | null => {
    const best = bestArrangement(picked.map((i) => families[i] as string), mode, options);
    return best && { ...best, picked };
  };

  // Descending, so `widest` is the largest size that passes the checks at all — the answer the
  // previous version gave — and it stands in when nothing clears the bar. Without it, a preference
  // would be able to refuse a palette outright, which is the mistake `avoid` already made once.
  let widest: Pick | null = null;
  let chosen: Pick | null = null;
  for (let k = Math.min(usable.length, MAX_ORDERED); k >= 2 && !chosen; k--) {
    let bestAtK: Pick | null = null;
    for (const picked of combinations(usable.length, k)) {
      const pick = bestOf(picked);
      if (pick && (!bestAtK || pick.delta > bestAtK.delta)) bestAtK = pick;
    }
    if (!bestAtK) continue;
    widest ??= bestAtK;
    if (bestAtK.delta >= separation) chosen = bestAtK;
  }

  const best = chosen ?? widest;
  const ordered = best?.ordered ?? [];
  const taken = new Set(best?.picked ?? []);
  return {
    colours: best?.colours ?? candidates(families, mode, 1)[0] ?? [],
    ordered,
    leading: leadingClear(ordered, options.avoid ?? []),
    kept: best ? best.picked.map((i) => families[i] as string) : families,
    // Empty when nothing was derived: a refusal rejected no family in particular, and saying it
    // crowded them out would be a reason where there was only a failure.
    crowded: best ? usable.filter((_, i) => !taken.has(i)) : [],
    // From `checkScheme` and not from the search's own index, even though the two agree by
    // construction. The index is an optimisation; the gate is the rule, and the number a caller is
    // told should be the rule's. If they ever part, this reports the truth and the search merely
    // ranks badly — a much smaller failure than publishing a figure no gate stands behind.
    separation: ordered.length ? checkScheme(ordered, { mode }).cvd.delta : 0,
    families,
    dropped,
  };
}

export interface SchemeDerivation {
  /** The light-mode slots, in the order they are handed out. Empty when nothing can be arranged. */
  light: string[];
  /** The dark-mode slots — the same families, in each mode's own best sequence. */
  dark: string[];
  /** Every family the source yielded, before selection. */
  families: string[];
  /** The families that made the scheme. The same set in both modes, which is the point. */
  kept: string[];
  /** Usable colours the scheme had no separation left for. Never conflated with `dropped`. */
  crowded: string[];
  /** Source colours that carried no usable hue. */
  dropped: string[];
  /**
   * The worst adjacent pair under simulation, **per mode**.
   *
   * Both, never their minimum. A scheme is routinely comfortable on one surface and marginal on the
   * other — Catppuccin Mocha reaches 19.7 in light and 25.6 in dark — and a caller handed only the
   * worse number cannot say which mode to warn about, nor stop warning about the mode that is fine.
   */
  separation: { light: number; dark: number };
  /**
   * How many leading slots ended up clear of `avoid`, per mode.
   *
   * Per mode for the same reason as `separation`: the sequences differ, so the count does too, and
   * `orderScheme` degrades rather than refusing. Measured with `--destructive` avoided, kanzo holds
   * four in light and two in dark on the very same five families.
   */
  leading: { light: number; dark: number };
}

/**
 * One family subset, both modes — the derivation a `SchemeColors` can actually be built from.
 *
 * `deriveOrderedScheme` answers for one mode, and answering twice does not compose: the subset rule
 * picks the size each mode can afford, and the two modes disagree. Measured with the status palette
 * avoided: kanzo takes 7 families in light and 5 in dark, Catppuccin Latte 7 and 5, kanzo-dark 7 and
 * 8. But `SchemeColors` is `{ light, dark }` over **one** set of categories, because a series keeps
 * its identity across a mode flip — slot 3 is the same thing in both, or the legend lies.
 *
 * Reconciling after the fact is lossy, and that is the measurement that made this function exist.
 * Intersecting the two modes' `crowded` sets and re-deriving collapses Dracula to 3 categories where
 * searching jointly finds 4, and costs kanzo 4.4 ΔE in light (32.5 → 28.1). The reason is that a
 * subset good for light and a subset good for dark are different subsets, and the best *shared* one
 * is often neither — it cannot be recovered from two independent answers because neither of them
 * ever considered it.
 *
 * So the descent runs once over shared subsets, scored on `min(light, dark)`: a scheme is only as
 * separable as its worse surface, and the same descending-and-bar rule then applies to that. What is
 * *reported* is never the minimum — see `separation`.
 *
 * Costs both modes per subset, and descends further than either mode alone would, so it is strictly
 * the more expensive search — which is what the pair index above buys the room for. Measured cold,
 * one palette per process: 0 ms to 286 ms, against 0 ms to 242 ms for a single mode. The pruning
 * below is why it is not simply double: the joint score cannot beat the light score, so most subsets
 * never pay for their dark search at all.
 */
export function deriveSchemeColors(
  source: readonly string[],
  options: DeriveOptions = {},
): SchemeDerivation {
  const { families, dropped, usable } = familiesOf(source);
  const { separation = SEPARATION_BAR, avoid = [] } = options;

  type Joint = { light: Arrangement; dark: Arrangement; picked: number[]; score: number };
  let widest: Joint | null = null;
  let chosen: Joint | null = null;
  for (let k = Math.min(usable.length, MAX_ORDERED); k >= 2 && !chosen; k--) {
    let bestAtK: Joint | null = null;
    for (const picked of combinations(usable.length, k)) {
      const names = picked.map((i) => families[i] as string);
      const light = bestArrangement(names, "light", options);
      if (!light) continue;
      // The joint score cannot exceed either mode's, so a subset already beaten in light is beaten.
      // Free, and it skips the dark search for most of the combinations at every size.
      if (bestAtK && light.delta <= bestAtK.score) continue;
      const dark = bestArrangement(names, "dark", options);
      if (!dark) continue;
      const score = Math.min(light.delta, dark.delta);
      if (!bestAtK || score > bestAtK.score) bestAtK = { light, dark, picked, score };
    }
    if (!bestAtK) continue;
    widest ??= bestAtK;
    if (bestAtK.score >= separation) chosen = bestAtK;
  }

  const best = chosen ?? widest;
  const taken = new Set(best?.picked ?? []);
  const light = best?.light.ordered ?? [];
  const dark = best?.dark.ordered ?? [];
  return {
    light,
    dark,
    families,
    // On a refusal, everything usable stays in `kept` and nothing is `crowded` — same reading as
    // `deriveOrderedScheme`. A refusal rejected no family in particular, so naming some of them
    // crowded would invent a reason where there was only a failure, and it would break the
    // accounting a panel adds up: `kept + crowded + dropped` is always the source.
    kept: best ? best.picked.map((i) => families[i] as string) : families,
    crowded: best ? usable.filter((_, i) => !taken.has(i)) : [],
    dropped,
    separation: {
      light: light.length ? checkScheme(light, { mode: "light" }).cvd.delta : 0,
      dark: dark.length ? checkScheme(dark, { mode: "dark" }).cvd.delta : 0,
    },
    leading: { light: leadingClear(light, avoid), dark: leadingClear(dark, avoid) },
  };
}
