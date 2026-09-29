import type { Tile } from "./tile";

/**
 * deck.gl's `'best-available'` refinement — `updateTileStateDefault`, the only strategy.
 *
 * A selected tile with content is drawn. One without is covered by its nearest ancestor holding
 * content, and failing that by whatever of its descendants holds some, so a pan never shows a hole.
 * A parent is therefore drawn only while a selected child is loading: at rest every selected tile
 * holds content and no stand-in is needed.
 *
 * "Holding content" rather than deck.gl's `isLoaded`, because a tile reloading for a new question
 * keeps its old picture until the new one arrives.
 */
export function refine(tiles: Iterable<Tile>): void {
  const all = [...tiles];
  const visible = new Set<Tile>();
  for (const tile of all) {
    if (tile.isSelected && !inAncestors(tile, visible)) inDescendants(tile, visible);
  }
  for (const tile of all) tile.isVisible = visible.has(tile);
}

function inAncestors(start: Tile, visible: Set<Tile>): boolean {
  for (let tile: Tile | null = start; tile; tile = tile.parent) {
    if (tile.content) {
      visible.add(tile);
      return true;
    }
  }
  return false;
}

function inDescendants(tile: Tile, visible: Set<Tile>): void {
  for (const child of tile.children) {
    if (child.content) visible.add(child);
    else inDescendants(child, visible);
  }
}
