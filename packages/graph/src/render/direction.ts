/**
 * **The vertex a key moves to**: of the kept, placed vertices, the nearest one the way `direction`
 * points on screen, scored by how far along it lies plus twice how far across — so a neighbour in line
 * beats a nearer one off to the side. With no direction, simply the nearest. `positions` are the layout's
 * `[x, y, …]` by id and `scale` is how far a unit of space is on screen on each axis, signed: the
 * screen's `y` runs down and the layout's need not.
 */
export function nearest(
  positions: ArrayLike<number>,
  kept: Uint8Array | null,
  from: readonly [number, number],
  direction: readonly [number, number] | null,
  scale: readonly [number, number],
  skip: number | null,
): number | null {
  let best: number | null = null;
  let cost = Infinity;
  for (let id = 0; 2 * id < positions.length; id++) {
    const x = positions[2 * id] as number;
    const y = positions[2 * id + 1] as number;
    if (id === skip || Number.isNaN(x) || Number.isNaN(y) || (kept && !kept[id])) continue;
    const dx = (x - from[0]) * scale[0];
    const dy = (y - from[1]) * scale[1];
    let score = Math.hypot(dx, dy);
    if (direction) {
      const along = dx * direction[0] + dy * direction[1];
      if (along <= 0) continue;
      score = along + 2 * Math.abs(dx * direction[1] - dy * direction[0]);
    }
    if (score < cost) [best, cost] = [id, score];
  }
  return best;
}
