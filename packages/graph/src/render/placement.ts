import type { Geometry } from "../core/load";

type Extent = NonNullable<Geometry["extent"]>;

/**
 * **Where the corpus's extent sits in cosmos.gl's square** — centred, at its own scale, and scaled
 * down only past the box the device can simulate in. Drawing alone is translation-invariant, but the
 * layout is not: gravity pulls toward the square's centre and many-body bins points on a grid over
 * `[0, side]²`, so an extent left where it was contracts toward a corner and falls off the grid.
 */
export interface Placement {
  readonly side: number;
  readonly k: number;
  readonly dx: number;
  readonly dy: number;
}

/** No extent — no row has a position — so nothing moves and nothing is drawn. */
export const UNPLACED: Placement = { side: 0, k: 1, dx: 0, dy: 0 };

export function placementOf(extent: Extent, box: number): Placement {
  const longest = Math.max(extent.w, extent.h, 2);
  const k = longest > box ? box / longest : 1;
  const side = longest * k;
  return { side, k, dx: (side - extent.w * k) / 2 - extent.x * k, dy: (side - extent.h * k) / 2 - extent.y * k };
}

/** The loaded positions in the square, with `NaN` where the page's filter hides a vertex — cosmos.gl draws no such point. */
export function placed(geometry: Geometry, at: Placement, mask: Uint8Array | null): Float32Array {
  const { positions } = geometry;
  const out = new Float32Array(positions.length);
  for (let id = 0; id < geometry.size; id++) {
    const hidden = mask !== null && !mask[id];
    out[id * 2] = hidden ? Number.NaN : (positions[id * 2] as number) * at.k + at.dx;
    out[id * 2 + 1] = hidden ? Number.NaN : (positions[id * 2 + 1] as number) * at.k + at.dy;
  }
  return out;
}

/** The extent's corners in the square, for a camera that frames it. */
export function cornersOf(extent: Extent, at: Placement): number[] {
  return [extent.x * at.k + at.dx, extent.y * at.k + at.dy, (extent.x + extent.w) * at.k + at.dx, (extent.y + extent.h) * at.k + at.dy];
}
