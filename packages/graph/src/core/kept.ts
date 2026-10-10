import type { Encoding, Geometry } from "./load";
import type { Drawn } from "./state";
import type { VertexId } from "./types";

/** How many vertices a mask keeps, or `null` when nothing is filtered. */
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

/**
 * **What is in full colour, as a mask**: `mask` narrowed to the canvas's own pick, what
 * {@link visibleOf} lists. The graph's client is exempt from the clause it publishes, as Mosaic
 * exempts every client, so `mask` alone is the page's filter without the canvas's lasso, marquee or
 * click; the counts and the legend read this one, so they count what the canvas colours and the
 * toolbar reads. `mask` itself when nothing is picked.
 */
export function litOf(size: number, mask: Uint8Array | null, selection: readonly VertexId[] | null): Uint8Array | null {
  if (selection === null) return mask;
  const lit = new Uint8Array(size);
  for (const id of selection) if (id < size && (mask === null || mask[id])) lit[id] = 1;
  return lit;
}

/**
 * **What the loaded graph holds, counted once per geometry, encoding and filter**: per rank what is
 * drawn, placed and in the corpus, and the links drawn, placed and loaded. A vertex is placed when
 * it has a position — always, under a layout; under bound positions, when it has both values.
 */
export function drawnOf(geometry: Geometry, encoding: Encoding, mask: Uint8Array | null): Drawn {
  const tally = encoding.domain.map(() => 0);
  const placed = encoding.domain.map(() => 0);
  const totals = encoding.domain.map(() => 0);
  const shown = new Uint8Array(geometry.size);
  let vertices = 0;
  for (let id = 0; id < geometry.size; id++) {
    const rank = encoding.ranks[id] as number;
    totals[rank] = (totals[rank] ?? 0) + 1;
    if (Number.isNaN(geometry.positions[id * 2])) continue;
    placed[rank] = (placed[rank] ?? 0) + 1;
    shown[id] = 2;
    if (mask && !mask[id]) continue;
    shown[id] = 1;
    vertices++;
    tally[rank] = (tally[rank] ?? 0) + 1;
  }
  let edges = 0;
  let placedLinks = 0;
  const { links } = geometry;
  for (let i = 0; i < links.length; i += 2) {
    const a = shown[links[i] as number];
    const b = shown[links[i + 1] as number];
    if (a && b) placedLinks++;
    if (a === 1 && b === 1) edges++;
  }
  return { vertices, edges, domain: encoding.domain, tally, placed, totals, links: links.length / 2, placedLinks };
}
