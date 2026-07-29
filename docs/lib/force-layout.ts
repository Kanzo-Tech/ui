// A small seeded force layout. The Discovery showcase runs it once, at build time, to bake `x`/`y`
// into the node relation — the GPU simulation starts from those rather than from noise.
//
// d3-force is in the store as a transitive of `d3`, but not a declared dependency of anything we
// own, so it is not resolvable under pnpm's strict layout. This is the stand-in: grid-bucketed
// repulsion (O(n·k) instead of O(n²)), spring attraction along edges, and gravity.

export interface LayoutEdge {
  source: number;
  target: number;
}

const CELL = 2;
const CUTOFF2 = CELL * CELL;
const REPEL = 1.1;
const SPRING = 0.32;
const REST = 1;
const GRAVITY = 0.035;
const FRICTION = 0.6;
const MAX_STEP = 2;
const DECAY = 0.972;

/** A deterministic PRNG — same seed, same picture, in every browser and every run. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Positions for `count` vertices joined by `edges`.
 *
 * What this buys is **link coherence**: on the Discovery corpus the mean edge comes out at 0.17 of
 * the layout's width against 0.54 for an unseeded start, so the picture opens with adjacent things
 * adjacent instead of resolving into one over the first seconds of simulation. Determinism is the
 * other half — `rand` is `mulberry32`, so the same corpus opens the same way in every browser.
 *
 * What it does **not** buy is community separation, whatever `group` looks like it promises. The
 * angular initialisation below does separate groups — a 2.40 between/within centroid ratio at tick
 * 0 — and its own relaxation then erases it: 1.94 by tick 5, 0.67 by tick 50, and flat from there
 * to tick 400, at which point 8-nearest-neighbour purity is 17.1% against a 13.2% chance floor for
 * these group sizes. It has to. Springs pull along edges, and where groups share vertices the edges
 * genuinely cross the groups, so keeping them apart is a constraint the link structure disagrees
 * with. That belongs to a force which ignores links — on this canvas, cosmos.gl's cluster force
 * with explicit positions (`showcases/workspace/cluster-ring`).
 */
export function forceLayout(
  count: number,
  edges: readonly LayoutEdge[],
  group: ArrayLike<number>,
  groups: number,
  ticks: number,
  rand: () => number,
): { x: Float64Array; y: Float64Array } {
  const x = new Float64Array(count);
  const y = new Float64Array(count);
  const vx = new Float64Array(count);
  const vy = new Float64Array(count);

  // Density-constant world: the radius grows with sqrt(n), so 200 and 20 000 vertices sit at the
  // same spacing and the same force constants hold at both ends.
  const radius = Math.max(6, Math.sqrt(count) * 0.9);
  for (let i = 0; i < count; i++) {
    const angle = ((group[i]! / groups) * 2 + rand() * 0.6) * Math.PI;
    const r = radius * (0.25 + rand() * 0.45);
    x[i] = Math.cos(angle) * r;
    y[i] = Math.sin(angle) * r;
  }

  const side = Math.max(1, Math.ceil((2 * radius) / CELL));
  const cells = side * side;
  const counts = new Int32Array(cells + 1);
  const starts = new Int32Array(cells + 1);
  const order = new Int32Array(count);
  const cellOf = new Int32Array(count);

  let alpha = 1;
  for (let tick = 0; tick < ticks; tick++, alpha *= DECAY) {
    counts.fill(0);
    for (let i = 0; i < count; i++) {
      const cx = Math.min(side - 1, Math.max(0, ((x[i]! + radius) / CELL) | 0));
      const cy = Math.min(side - 1, Math.max(0, ((y[i]! + radius) / CELL) | 0));
      const c = cy * side + cx;
      cellOf[i] = c;
      counts[c]!++;
    }
    for (let c = 0, sum = 0; c <= cells; c++) {
      starts[c] = sum;
      sum += counts[c] ?? 0;
    }
    counts.set(starts.subarray(0, cells));
    for (let i = 0; i < count; i++) order[counts[cellOf[i]!]!++] = i;

    for (let i = 0; i < count; i++) {
      const c = cellOf[i]!;
      const cx = c % side;
      const cy = (c / side) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= side) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          if (nx < 0 || nx >= side) continue;
          const n = ny * side + nx;
          const end = Math.min(starts[n + 1]!, starts[n]! + 10);
          for (let k = starts[n]!; k < end; k++) {
            const j = order[k]!;
            if (j === i) continue;
            let ax = x[i]! - x[j]!;
            let ay = y[i]! - y[j]!;
            let d2 = ax * ax + ay * ay;
            if (d2 === 0) {
              ax = (rand() - 0.5) * 0.01;
              ay = (rand() - 0.5) * 0.01;
              d2 = ax * ax + ay * ay;
            }
            if (d2 > CUTOFF2) continue;
            const f = (REPEL * alpha) / Math.max(d2, 0.05);
            vx[i]! += ax * f;
            vy[i]! += ay * f;
          }
        }
      }
    }

    for (const { source, target } of edges) {
      const ax = x[target]! - x[source]!;
      const ay = y[target]! - y[source]!;
      const d = Math.sqrt(ax * ax + ay * ay) || 1e-6;
      const f = (SPRING * alpha * (d - REST)) / d;
      vx[source]! += ax * f;
      vy[source]! += ay * f;
      vx[target]! -= ax * f;
      vy[target]! -= ay * f;
    }

    for (let i = 0; i < count; i++) {
      vx[i]! -= x[i]! * GRAVITY * alpha;
      vy[i]! -= y[i]! * GRAVITY * alpha;
      const step = Math.hypot(vx[i]!, vy[i]!);
      if (step > MAX_STEP) {
        vx[i]! *= MAX_STEP / step;
        vy[i]! *= MAX_STEP / step;
      }
      x[i] = Math.min(radius, Math.max(-radius, x[i]! + vx[i]!));
      y[i] = Math.min(radius, Math.max(-radius, y[i]! + vy[i]!));
      vx[i]! *= FRICTION;
      vy[i]! *= FRICTION;
    }
  }

  return { x, y };
}

/** Rescale in place to [0, 1] — the domain both graph views draw in. */
export function normalise(values: Float64Array): void {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  for (let i = 0; i < values.length; i++) values[i] = (values[i]! - lo) / span;
}
