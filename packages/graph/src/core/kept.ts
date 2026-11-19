import type { Encoding, Geometry } from "./load";
import type { Drawn, GraphSnapshot } from "./state";
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
 * A link is kept exactly when its two ends are, `keptLinksOf`, so no clause is on links: the
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
 * Whether anything is greyed out: the canvas picked something, or a clause keeps fewer than the
 * graph holds. The toolbar shows its count on it, and `frame()` frames everything without it — a
 * mask that keeps every vertex greys none, so what it keeps is the whole graph.
 */
export const greyedOf = ({ selection, matching, total }: Pick<GraphSnapshot, "selection" | "matching" | "total">): boolean =>
  matching !== null && (selection !== null || matching !== total);

/** The links `kept` keeps, by index: those whose two ends it keeps. `null` for no mask, which keeps every link. */
export function keptLinksOf(links: Geometry["links"], kept: Uint8Array | null): number[] | null {
  if (kept === null) return null;
  const ids: number[] = [];
  for (let e = 0; e < links.length / 2; e++) if (kept[links[2 * e] as number] && kept[links[2 * e + 1] as number]) ids.push(e);
  return ids;
}

/**
 * **What the loaded graph holds, counted once per geometry, encoding and filter**: per rank what is
 * drawn, placed and in the graph, and the links drawn, placed and loaded. A vertex is placed when
 * it has a position — always, under a layout; under bound positions, when it has both values. The
 * links drawn are `keptLinks` with both ends placed.
 */
export function drawnOf(geometry: Pick<Geometry, "size" | "positions" | "links">, encoding: Pick<Encoding, "ranks" | "domain">, mask: Uint8Array | null, keptLinks: readonly number[] | null): Drawn {
  const tally = encoding.domain.map(() => 0);
  const placed = encoding.domain.map(() => 0);
  const totals = encoding.domain.map(() => 0);
  const at = new Uint8Array(geometry.size);
  let vertices = 0;
  for (let id = 0; id < geometry.size; id++) {
    const rank = encoding.ranks[id] as number;
    totals[rank] = (totals[rank] ?? 0) + 1;
    if (!placedAt(geometry.positions, id)) continue;
    placed[rank] = (placed[rank] ?? 0) + 1;
    at[id] = 1;
    if (mask && !mask[id]) continue;
    vertices++;
    tally[rank] = (tally[rank] ?? 0) + 1;
  }
  const { links } = geometry;
  const both = (e: number) => at[links[2 * e] as number] === 1 && at[links[2 * e + 1] as number] === 1;
  let placedLinks = 0;
  for (let e = 0; e < links.length / 2; e++) if (both(e)) placedLinks++;
  let edges = placedLinks;
  if (keptLinks) {
    edges = 0;
    for (const e of keptLinks) if (both(e)) edges++;
  }
  return { vertices, edges, domain: encoding.domain, tally, placed, totals, links: links.length / 2, placedLinks };
}
