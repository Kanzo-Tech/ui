import type { Encoding, Geometry } from "./load";
import type { Drawn } from "./state";
import type { VertexId } from "./types";

/**
 * Whether a vertex has a position: both of its coordinates are numbers. Under a layout every vertex
 * has one; under bound positions a vertex with no value in `x` or `y` is `NaN` there and is not drawn.
 * It is not a filter's result: no clause changes it.
 */
export const placedAt = (positions: Float32Array, id: number): boolean =>
  Number.isFinite(positions[id * 2]) && Number.isFinite(positions[id * 2 + 1]);

/** `1` where a vertex is among `ids`. */
export function maskOf(size: number, ids: Float64Array): Uint8Array {
  const mask = new Uint8Array(size);
  for (const id of ids) if (id < size) mask[id] = 1;
  return mask;
}

/**
 * **What is kept** — the one reading of the page's crossfilter, which every view of the graph draws:
 * the canvas colours it and greys the rest, the labels name it, the counts and the legend count it,
 * the toolbar and `frame()` act on it. It is the page's other clauses (`filter`, what the coordinator
 * answers the graph's client, which Mosaic exempts from its own clause) narrowed to the canvas's own
 * clause (`pick`), so the canvas's clause is a clause like every other: kept means every clause keeps
 * it. `null` when no clause is set, which keeps everything. A pick of an id the geometry does not hold
 * is no vertex, and keeps nothing. `/docs/design/crossfilter#formal-semantics` defines it.
 *
 * A link is kept exactly when its two ends are, which is why there is no link mask beside it: the
 * timeline's window is a clause on vertex tables, so it arrives inside `filter`.
 */
export function keptOf(size: number, filter: Uint8Array | null, pick: readonly VertexId[] | null, excludes = false): Uint8Array | null {
  if (pick === null) return filter;
  if (excludes) {
    // The canvas's clause leaves `pick` out: kept is the filter, less it.
    const kept = filter ? filter.slice() : new Uint8Array(size).fill(1);
    for (const id of pick) if (id < size) kept[id] = 0;
    return kept;
  }
  const kept = new Uint8Array(size);
  for (const id of pick) if (id < size && (filter === null || filter[id])) kept[id] = 1;
  return kept;
}

/**
 * The ids `kept` keeps, ascending, and — given positions — only those placed: what the toolbar counts
 * and `frame()` fits. `null` for no mask, which keeps everything.
 */
export function idsOf(kept: Uint8Array | null, positions: Float32Array | null = null): VertexId[] | null {
  if (kept === null) return null;
  const ids: VertexId[] = [];
  for (let id = 0; id < kept.length; id++) if (kept[id] && (positions === null || placedAt(positions, id))) ids.push(id);
  return ids;
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
    if (!placedAt(geometry.positions, id)) continue;
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
