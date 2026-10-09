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

/** What is in full colour — `GraphStore.visible`, computed. */
export function visibleOf(mask: Uint8Array | null, selection: readonly VertexId[] | null): readonly VertexId[] | null {
  if (selection !== null) return mask === null ? selection : selection.filter((id) => mask[id] === 1);
  if (mask === null) return null;
  const ids: VertexId[] = [];
  for (let id = 0; id < mask.length; id++) if (mask[id]) ids.push(id);
  return ids;
}
