import type { Geometry } from "../core/load";

type Extent = NonNullable<Geometry["extent"]>;

/**
 * **Where the corpus's extent sits in cosmos.gl's square** — centred, at its own scale, and scaled
 * down only past the box the device can simulate in. Drawing alone is translation-invariant, but the
 * layout is not: gravity pulls toward the square's centre and many-body bins points on a grid over
 * `[0, side]²`, so an extent left where it was contracts toward a corner and falls off the grid.
 *
 * **`k` is never negative, and that is what keeps north up.** cosmos.gl's space is y-up — its store
 * maps `scalePointY.domain([side, 0])` onto the screen top-down — so a latitude bound to `y` draws
 * north at the top as long as nothing here flips it. A screen-convention flip would put it south.
 */
export interface Placement {
  readonly side: number;
  readonly k: number;
  readonly dx: number;
  readonly dy: number;
}

export function placementOf(extent: Extent, box: number): Placement {
  const longest = Math.max(extent.w, extent.h, 2);
  const k = longest > box ? box / longest : 1;
  const side = longest * k;
  return { side, k, dx: (side - extent.w * k) / 2 - extent.x * k, dy: (side - extent.h * k) / 2 - extent.y * k };
}

/** Bound positions in the square. A vertex with no value stays `NaN`, which cosmos.gl does not draw. */
export function placed(positions: Float32Array, at: Placement): Float32Array {
  const out = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 2) {
    out[i] = (positions[i] as number) * at.k + at.dx;
    out[i + 1] = (positions[i + 1] as number) * at.k + at.dy;
  }
  return out;
}

/** The extent's corners in the square, for a camera that frames it. */
export function cornersOf(extent: Extent, at: Placement): number[] {
  return [extent.x * at.k + at.dx, extent.y * at.k + at.dy, (extent.x + extent.w) * at.k + at.dx, (extent.y + extent.h) * at.k + at.dy];
}
