/**
 * Synthetic graphs big enough to find the ceiling.
 *
 * Two shapes, because they break different things. A hyperbolic random graph has a power-law degree
 * tail and real communities, so it stresses the layout — dense hubs, uneven cell occupancy, the
 * cases the repulsion force is actually tuned for. A mesh has uniform degree and is trivially
 * laid out, so it isolates the cost of *quantity* from the cost of *structure*.
 *
 * The hyperbolic construction follows cosmos.gl's own `src/stories/utils.ts` (MIT), which is the
 * generator their performance stories are measured against — the point of reusing it is that our
 * numbers and theirs describe the same object.
 *
 * Nothing here chooses a colour. The generator hands back a community index per node and lets the
 * canvas' palette answer, because a categorical scale that a fixture invents is a scale that
 * disagrees with every legend on the page.
 */

/** What every generator produces: geometry and grouping, no appearance. */
export interface Generated {
  /** `[x0, y0, x1, y1, …]`, already inside `spaceSize`. */
  positions: Float32Array;
  /** `[source, target, …]` as point indices. */
  links: Float32Array;
  /** Degree per node, for the size ramp. */
  degree: Float32Array;
  /** Community index per node — the angular sector for hyperbolic, the row band for mesh. */
  community: Uint16Array;
  pointCount: number;
  linkCount: number;
}

/** Mulberry32. Seeded, so a size always generates the same graph and two runs are comparable. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** First index where `arr[i] >= value`, over the first `n` entries. */
function lowerBound(arr: Float64Array, value: number, n: number): number {
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((arr[mid] as number) < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export interface HyperbolicOptions {
  pointCount: number;
  /** Target mean degree; links ≈ pointCount × avgDegree / 2. */
  avgDegree?: number;
  /** Power-law steepness. Must exceed 0.5; higher means a heavier tail. */
  alpha?: number;
  spaceSize?: number;
  seed?: number;
  /** How many angular sectors become communities. */
  communities?: number;
}

const TWO_PI = Math.PI * 2;

/**
 * A hyperbolic random graph in the threshold model.
 *
 * Nodes are sampled in the native 2D hyperbolic disk — a uniform angle, and a radius drawn from
 * `ρ(r) ∝ α·sinh(α·r)` so most sit near the boundary and a few near the centre — and two nodes are
 * linked when their hyperbolic distance falls under `R`. That yields a power-law degree
 * distribution, high clustering and communities that emerge as angular sectors rather than being
 * planted, which is what makes the result look like a real network once it is laid out.
 *
 * Near O(N + E): nodes are sorted by angle and each one scans only an angular window sized by its
 * own radius, so every edge is discovered once, from its more central endpoint.
 */
export function hyperbolic(options: HyperbolicOptions): Generated {
  const n = options.pointCount;
  const avgDegree = options.avgDegree ?? 14;
  const alpha = Math.max(0.5001, options.alpha ?? 0.75);
  const spaceSize = options.spaceSize ?? 8192;
  const sectors = options.communities ?? 8;
  const rng = makeRng(options.seed ?? 0x9e3779b9);

  // Disk radius from the target mean degree (Gugelmann/Krioukov approximation).
  const xi = (2 / Math.PI) * ((alpha / (alpha - 0.5)) ** 2);
  const R = 2 * Math.log((xi * n) / avgDegree);
  const coshR = Math.cosh(R);
  const coshAR = Math.cosh(alpha * R);

  const theta = new Float64Array(n);
  const radius = new Float64Array(n);
  const coshr = new Float64Array(n);
  const sinhr = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    theta[i] = rng() * TWO_PI;
    // Inverse CDF of ρ(r).
    const r = Math.acosh(1 + rng() * (coshAR - 1)) / alpha;
    radius[i] = r;
    coshr[i] = Math.cosh(r);
    sinhr[i] = Math.sinh(r);
  }

  const order = new Int32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  order.sort((a, b) => (theta[a] as number) - (theta[b] as number));
  const sortedAngles = new Float64Array(n);
  for (let k = 0; k < n; k++) sortedAngles[k] = theta[order[k] as number] as number;

  /**
   * Endpoints, growable.
   *
   * `Float32Array` because that is the type cosmos.gl's link buffer takes, and a float holds an
   * exact integer only up to 2^24 — so this generator tops out at 16.7M points before an index
   * starts rounding to its neighbour. Well past anything the renderer survives, but it is a real
   * edge and not a theoretical one.
   */
  let links = new Float32Array(Math.ceil(n * avgDegree * 1.3));
  let length = 0;
  const degree = new Float32Array(n);

  const push = (a: number, b: number): void => {
    if (length + 2 > links.length) {
      const grown = new Float32Array(links.length * 2);
      grown.set(links);
      links = grown;
    }
    links[length++] = a;
    links[length++] = b;
    degree[a]++;
    degree[b]++;
  };

  // Accept only the more peripheral partner, so each edge is found exactly once.
  const tryLink = (i: number, j: number): void => {
    if (j === i) return;
    const ri = radius[i] as number;
    const rj = radius[j] as number;
    if (rj < ri || (rj === ri && j <= i)) return;
    let dt = Math.abs((theta[i] as number) - (theta[j] as number));
    if (dt > Math.PI) dt = TWO_PI - dt;
    const coshd =
      (coshr[i] as number) * (coshr[j] as number) -
      (sinhr[i] as number) * (sinhr[j] as number) * Math.cos(dt);
    if (coshd <= coshR) push(i, j);
  };

  for (let i = 0; i < n; i++) {
    const ri = radius[i] as number;
    let window: number;
    if (ri < 1e-9) {
      window = Math.PI;
    } else {
      const c = ((coshr[i] as number) ** 2 - coshR) / ((sinhr[i] as number) ** 2);
      if (c <= -1) window = Math.PI;
      else if (c >= 1) window = 0;
      else window = Math.acos(c);
    }
    if (window <= 0) continue;
    if (window >= Math.PI) {
      // A hub reaches everyone, so there is no window to narrow.
      for (let j = 0; j < n; j++) tryLink(i, j);
      continue;
    }
    const a = theta[i] as number;
    const lo = a - window;
    const hi = a + window;
    const scan = (from: number, to: number): void => {
      let k = lowerBound(sortedAngles, from, n);
      while (k < n && (sortedAngles[k] as number) < to) {
        tryLink(i, order[k] as number);
        k++;
      }
    };
    scan(Math.max(0, lo), Math.min(TWO_PI, hi));
    if (lo < 0) scan(TWO_PI + lo, TWO_PI);
    if (hi > TWO_PI) scan(0, hi - TWO_PI);
  }

  // Seed the layout with the native polar arrangement: hubs near the centre, communities already
  // separated by angle. The simulation still runs — this only spares it the opening collapse.
  const positions = new Float32Array(n * 2);
  const community = new Uint16Array(n);
  const centre = spaceSize / 2;
  const radial = ((spaceSize / 2) * 0.92) / R;
  for (let i = 0; i < n; i++) {
    const rr = (radius[i] as number) * radial;
    positions[i * 2] = centre + rr * Math.cos(theta[i] as number);
    positions[i * 2 + 1] = centre + rr * Math.sin(theta[i] as number);
    community[i] = Math.min(sectors - 1, Math.floor(((theta[i] as number) / TWO_PI) * sectors));
  }

  return {
    positions,
    links: links.subarray(0, length),
    degree,
    community,
    pointCount: n,
    linkCount: length / 2,
  };
}

export interface MeshOptions {
  /** Points per row. The mesh is `columns × rows`. */
  columns: number;
  rows: number;
  /** Fraction of the lattice's edges actually drawn, `0`–`1`. */
  density?: number;
  spaceSize?: number;
  seed?: number;
  communities?: number;
}

/**
 * A lattice: uniform degree, no hubs, no communities worth the name.
 *
 * The control against `hyperbolic`. When a size is slow in both, the cost is quantity; when it is
 * slow only in the hyperbolic one, the cost is structure — and those have different fixes.
 */
export function mesh(options: MeshOptions): Generated {
  const { columns, rows } = options;
  const density = options.density ?? 1;
  const spaceSize = options.spaceSize ?? 8192;
  const sectors = options.communities ?? 8;
  const rng = makeRng(options.seed ?? 0x1a2b3c4d);
  const n = columns * rows;

  const positions = new Float32Array(n * 2);
  const degree = new Float32Array(n);
  const community = new Uint16Array(n);
  const pairs: number[] = [];

  // Seeded into a small blob at the centre rather than onto their lattice coordinates: a mesh that
  // starts already solved measures nothing about the layout.
  for (let i = 0; i < n; i++) {
    positions[i * 2] = spaceSize * (0.495 + rng() * 0.01);
    positions[i * 2 + 1] = spaceSize * (0.495 + rng() * 0.01);
    community[i] = Math.min(sectors - 1, Math.floor((Math.floor(i / columns) / rows) * sectors));

    const right = i + 1;
    const below = i + columns;
    if (Math.floor(right / columns) === Math.floor(i / columns) && rng() < density) {
      pairs.push(i, right);
      degree[i]++;
      degree[right]++;
    }
    if (below < n && rng() < density) {
      pairs.push(i, below);
      degree[i]++;
      degree[below]++;
    }
  }

  return {
    positions,
    links: Float32Array.from(pairs),
    degree,
    community,
    pointCount: n,
    linkCount: pairs.length / 2,
  };
}
