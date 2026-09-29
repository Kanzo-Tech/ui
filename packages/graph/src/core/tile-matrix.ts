import type { Box, TileAddress, TileMatrixSet } from "@fossil-lang/corpus";

/** A rectangle in the corpus's own coordinates, which are the camera's. */
export interface Viewport {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

/** deck.gl's `${x}-${y}-${z}`, on fossil's one-dimensional address. */
export const tileId = ({ tile, type, z }: TileAddress): string => `${type}-${z}-${tile}`;

/** Closed on both edges: a published box is a bound, not a selection. */
function meets(box: Box | null, view: Viewport): boolean {
  if (box === null) return true;
  return box.x <= view.xMax && box.x + box.w >= view.xMin && box.y <= view.yMax && box.y + box.h >= view.yMin;
}

/**
 * The tiles of one matrix in view — deck.gl's `getTileIndices`, as a cull rather than arithmetic:
 * where a rank falls on the plane depends on the positions, so only the published boxes can say.
 */
export function cull(
  set: TileMatrixSet,
  z: number,
  view: Viewport,
  among?: ReadonlySet<number>,
): number[] {
  const matrix = set.tileMatrices[z];
  if (!matrix) return [];
  const found: number[] = [];
  for (const info of matrix.tiles) {
    if (among && !among.has(info.tile)) continue;
    if (meets(info.bbox, view)) found.push(info.tile);
  }
  return found;
}

/**
 * **The finest planned `z` whose tiles in view hold, by their published `rows`, at most `limit`.**
 *
 * `planned` is what `scan.plan()` kept, by zoom — a filter on a payload column plans nothing below
 * `Z`, so the choice is among the planned zooms only and a coarse camera then draws rows. When no
 * zoom fits, the coarsest planned one is drawn.
 */
export function selectLevel(
  set: TileMatrixSet,
  view: Viewport,
  limit: number,
  planned: ReadonlyMap<number, ReadonlySet<number>>,
): { z: number; tiles: number[] } | null {
  const zooms = [...planned.keys()].sort((a, b) => b - a);
  let coarsest: { z: number; tiles: number[] } | null = null;
  for (const z of zooms) {
    const tiles = cull(set, z, view, planned.get(z));
    const infos = set.tileMatrices[z]?.tiles ?? [];
    let rows = 0;
    for (const tile of tiles) rows += infos[tile]?.rows ?? 0;
    if (rows <= limit) return { z, tiles };
    coarsest = { z, tiles };
  }
  return coarsest;
}

/**
 * The tile one zoom coarser that covers this one: `(z − 1, t >> (shift(z − 1) − shift(z)))`.
 * Every zoom has the same `tileRows`, so a coarser tile covers `2^Δshift` finer ones — sixteen
 * between the payload and the first rung, four between rungs.
 */
export function parentOf(set: TileMatrixSet, address: TileAddress): TileAddress | null {
  const { tile, type, z } = address;
  const here = set.tileMatrices[z];
  const above = set.tileMatrices[z - 1];
  if (!here || !above) return null;
  return { type, z: z - 1, tile: Math.floor(tile / 2 ** (above.shift - here.shift)) };
}

/** The centre of a tile's box, or of the extent when it publishes none. */
export function centreOf(set: TileMatrixSet, address: TileAddress): [number, number] | null {
  const box = set.tileMatrices[address.z]?.tiles[address.tile]?.bbox ?? set.extent;
  return box === null ? null : [box.x + box.w / 2, box.y + box.h / 2];
}

/** The payload tile a vertex's `dense_id` falls in. */
export function tileOfDense(set: TileMatrixSet, dense: number): TileAddress | null {
  const z = set.tileMatrices.length - 1;
  const matrix = set.tileMatrices[z];
  if (!matrix) return null;
  const tile = Math.floor(dense / matrix.tileRows);
  return tile < matrix.tiles.length ? { type: set.type, z, tile } : null;
}
