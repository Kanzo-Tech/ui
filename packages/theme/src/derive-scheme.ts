import themeDataJson from "../theme-data.json";
import {
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

/**
 * Snap a palette's colours onto the system's ramps for one mode.
 *
 * Order is the caller's: this chooses *steps*, not the sequence. Ordering is a separate decision
 * with its own objective (the worst adjacent pair), and conflating the two would hide which one
 * failed. Returns an empty `colours` when no combination clears band, chroma and separation — an
 * honest refusal rather than a palette that merely looks derived.
 */
export function deriveScheme(source: readonly string[], mode: Mode): Derivation {
  const dropped: string[] = [];
  const families: string[] = [];
  for (const hex of source) {
    const family = familyOf(hex);
    if (family === null) dropped.push(hex);
    else families.push(family);
  }
  if (!families.length) return { colours: [], families, dropped };

  const steps = Object.keys(RAMPS[families[0] as string] as Record<string, string>);
  let best: { colours: string[]; score: number } | null = null;

  // Every family independently takes any legal step. Small by construction — four steps over the
  // handful of families a palette yields — and exhaustive beats a greedy pass, which can strand
  // itself on a slot whose only legal step ruins its neighbour.
  const walk = (index: number, chosen: string[]) => {
    if (index === families.length) {
      const report = checkScheme(chosen, { mode });
      if (!report.ok) return;
      const score = Math.min(report.cvd.delta, report.normal.delta / 2) - report.relief.length;
      if (!best || score > best.score) best = { colours: [...chosen], score };
      return;
    }
    for (const step of steps) {
      const hex = (RAMPS[families[index] as string] as Record<string, string>)[step] as string;
      const { l, c } = oklch(hex);
      const [lo, hi] = mode === "light" ? [0.43, 0.77] : [0.48, 0.67];
      if (l < lo || l > hi || c < CHROMA_FLOOR) continue;
      walk(index + 1, [...chosen, hex]);
    }
  };
  walk(0, []);

  return { colours: best ? (best as { colours: string[] }).colours : [], families, dropped };
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
  let best: { order: string[]; score: number[] } | null = null;

  const walk = (rest: readonly string[], chosen: string[]) => {
    // `<=`, not `<`: the length is read *after* the push, so `<` never tested the last leading slot.
    if (chosen.length && chosen.length <= leading && clashes(chosen[chosen.length - 1] as string)) return;
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
}
