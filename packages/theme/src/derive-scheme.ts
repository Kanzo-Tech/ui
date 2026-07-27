import themeDataJson from "../theme-data.json";
import {
  BAND,
  CHROMA_FLOOR,
  NORMAL_FLOOR,
  checkScheme,
  deltaE,
  hueDistance,
  oklch,
  type Mode,
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
      const report = checkScheme(chosen, { mode, pairs: "all" });
      const score = Math.min(report.cvd.delta, report.normal.delta / 2) - report.relief.length;
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
  while (n <= colours.length && checkScheme(colours.slice(0, n), { mode, pairs: "all" }).ok) n += 1;
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
        const report = checkScheme(chosen, { mode });
        if (!report.ok) return;
        const score = [report.cvd.delta, allPairsCap(chosen, mode), -report.relief.length];
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
 * Measured over the six base16 palettes: 9 ms to 2.9 s to an answer, and 5.9 s for the worst case
 * there is at eight families, a descent all the way to two. That is what an authoring-time function
 * may spend. A source with more usable families than `MAX_ORDERED` no longer throws — the descent
 * simply starts there, which is the one thing subsetting buys for free — but C(n, 8) grows fast:
 * nine families measured 31 s, and twelve would be minutes.
 */
export function deriveOrderedScheme(
  source: readonly string[],
  mode: Mode,
  options: DeriveOptions = {},
): OrderedDerivation {
  const { families, dropped, usable } = familiesOf(source);
  const { separation = SEPARATION_BAR } = options;

  type Pick = { colours: string[]; ordered: string[]; delta: number; picked: number[] };
  const bestOf = (picked: number[]): Pick | null => {
    let best: Pick | null = null;
    for (const colours of candidates(
      picked.map((i) => families[i] as string),
      mode,
      SHORTLIST,
    )) {
      const ordered = orderScheme(colours, mode, options);
      if (!ordered.length) continue;
      const { delta } = checkScheme(ordered, { mode }).cvd;
      if (!best || delta > best.delta) best = { colours, ordered, delta, picked };
    }
    return best;
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
    separation: best?.delta ?? 0,
    families,
    dropped,
  };
}
