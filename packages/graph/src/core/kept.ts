import type { VertexId } from "./types";

/** How many vertices the page's filter keeps, or `null` when nothing is filtered. */
export function matchingOf(mask: Uint8Array | null): number | null {
  if (mask === null) return null;
  let n = 0;
  for (const kept of mask) n += kept;
  return n;
}

/** `1` where a vertex is among `ids`. */
export function maskOf(size: number, ids: Float64Array): Uint8Array {
  const mask = new Uint8Array(size);
  for (const id of ids) if (id < size) mask[id] = 1;
  return mask;
}

/**
 * **What is in full colour**, and everything else is greyed out: the vertices the page's filter keeps
 * and — when the reader picked some — those of them they picked, never a vertex the canvas does not
 * draw. `null` when nothing is filtered or picked, which is everything.
 *
 * The one reading of it: `GraphStore.visible` (what `frame()` and the toolbar act on) and the
 * renderer's `highlighted` (what the canvas colours) both answer this, so the tools cannot act on a
 * set the reader does not see. A link is in full colour exactly when its two ends are, which is why
 * there is no link mask beside `mask`: the timeline's window is a clause on vertex tables, so it
 * arrives inside `mask`. A filter that greys links on their own columns would be an argument here,
 * not a second rule in the renderer.
 *
 * Ascending when it comes from the filter; in the reader's order when it comes from a pick.
 */
export function visibleOf(
  size: number,
  mask: Uint8Array | null,
  selection: readonly VertexId[] | null,
): VertexId[] | null {
  if (mask === null && selection === null) return null;
  const ids: VertexId[] = [];
  if (selection === null) {
    for (let id = 0; id < size; id++) if ((mask as Uint8Array)[id]) ids.push(id);
  } else {
    for (const id of selection) if (id < size && (mask === null || mask[id])) ids.push(id);
  }
  return ids;
}
