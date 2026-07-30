// Deterministic randomness — the one copy.
//
// A showcase that reshuffles on reload is not a showcase: you cannot point at a bar and say "that
// one". Every generated fixture in the docs draws from here, seeded by a constant, so the same
// figure appears in every browser, every build and every snapshot.
//
// This lives in `lib/` rather than in `example/` because determinism is a docs-infrastructure
// concern, not part of the fiction — `force-layout` needs it too, and a layout helper importing
// from the example world would invert the dependency.

/** Same seed, same sequence, in every engine. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A drawing kit over one stream, so a fixture reads as intent rather than as arithmetic. */
export interface Rng {
  /** `[0, 1)`. */
  next(): number;
  /** Integer in `[min, max]`. */
  int(min: number, max: number): number;
  /** Float in `[min, max)`. */
  float(min: number, max: number): number;
  /** Uniform pick. */
  pick<T>(items: readonly T[]): T;
  /**
   * Weighted pick — `weights` is parallel to `items`.
   *
   * Fixtures need this more often than uniform: a quest board where every status is equally likely
   * looks generated, and a facet count of 20/20/20/20/20 tells a reader nothing about whether the
   * filter works.
   */
  weighted<T>(items: readonly T[], weights: readonly number[]): T;
  /** `true` with probability `p`. */
  chance(p: number): boolean;
  /** Approximately normal, via the mean of three draws. Clamped to `[mean - 3σ, mean + 3σ]`. */
  gauss(mean: number, sigma: number): number;
  /** A new array, shuffled. The input is untouched. */
  shuffle<T>(items: readonly T[]): T[];
  /** `count` distinct items, in draw order. Fewer if `items` is shorter. */
  sample<T>(items: readonly T[], count: number): T[];
}

export function rng(seed: number): Rng {
  const next = mulberry32(seed);

  const self: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    float: (min, max) => min + next() * (max - min),
    pick: (items) => items[Math.floor(next() * items.length)],

    weighted: (items, weights) => {
      let total = 0;
      for (const weight of weights) total += weight;
      let target = next() * total;
      for (let i = 0; i < items.length; i++) {
        target -= weights[i];
        if (target < 0) return items[i];
      }
      return items[items.length - 1];
    },

    chance: (p) => next() < p,

    gauss: (mean, sigma) => {
      const unit = (next() + next() + next()) / 3;
      // The mean of three uniforms has σ = 1/6, so scale by 6 to land on the requested σ.
      return mean + (unit - 0.5) * 6 * sigma;
    },

    shuffle: (items) => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },

    sample: (items, count) => self.shuffle(items).slice(0, Math.min(count, items.length)),
  };

  return self;
}
