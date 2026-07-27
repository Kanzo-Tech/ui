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

/** The families a source yields, and the colours that carried no usable hue. */
function familiesOf(source: readonly string[]) {
  const dropped: string[] = [];
  const families: string[] = [];
  for (const hex of source) {
    const family = familyOf(hex);
    if (family === null) dropped.push(hex);
    else families.push(family);
  }
  return { families, dropped };
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
 */
export function deriveOrderedScheme(
  source: readonly string[],
  mode: Mode,
  options: OrderOptions = {},
): OrderedDerivation {
  const { families, dropped } = familiesOf(source);
  let best: { colours: string[]; ordered: string[]; delta: number } | null = null;

  for (const colours of candidates(families, mode, SHORTLIST)) {
    const ordered = orderScheme(colours, mode, options);
    if (!ordered.length) continue;
    const { delta } = checkScheme(ordered, { mode }).cvd;
    if (!best || delta > best.delta) best = { colours, ordered, delta };
  }

  const ordered = best?.ordered ?? [];
  return {
    colours: best?.colours ?? candidates(families, mode, 1)[0] ?? [],
    ordered,
    leading: leadingClear(ordered, options.avoid ?? []),
    families,
    dropped,
  };
}
