import type { Coordinator } from "@kanzo-tech/mosaic";
import { Dictionary } from "./categories";
import type { Binding } from "./channels";
import { readColumns, readLinks } from "./source";
import { type Structure } from "./structure";

/**
 * **The whole graph, read once and laid out as cosmos.gl's buffers.** A vertex's `dense_id` is its
 * index, and a vertex table is one contiguous range of them, so each table's answer is written into
 * its own slice and nothing is resolved row by row.
 */

/** Where the vertices start and how they connect — read once per corpus and per position binding. */
export interface Geometry {
  readonly structure: Structure;
  /** Every vertex: ids `0 … size − 1`. */
  readonly size: number;
  /**
   * `[x, y, …]` by id. With `x` and `y` bound, the columns' values — `NaN` where a table lacks them,
   * which cosmos.gl does not draw. Unbound, a seeded start for the layout, inside `space`.
   */
  readonly positions: Float32Array;
  /** Whether the positions are the data's (`x`/`y` bound) or a start for the layout to move. */
  readonly bound: boolean;
  /** `[src, dst, …]` by id, every relation. */
  readonly links: Float32Array;
  /** Bound positions' extent; `null` for a layout's start, whose square is `space`. */
  readonly extent: { readonly x: number; readonly y: number; readonly w: number; readonly h: number } | null;
  /** The side of the square the layout runs in. */
  readonly space: number;
}

/** What the bound channels say about each vertex — read again when a binding changes. */
export interface Encoding {
  /** By id, the category's rank. */
  readonly ranks: Uint32Array;
  /** By id, the size ramp's raw value: the bound `r` column, or the vertex's degree. */
  readonly sizes: Float32Array;
  /** By id, the cluster a layout pulls the vertex toward, or `null` when `cluster` is unbound. */
  readonly clusters: (number | undefined)[] | null;
  /** What each rank is: the seed, then the other values seen, in rank order. */
  readonly domain: readonly unknown[];
}

/**
 * The layout's square: cosmos.gl's own 4,096 up to 200,000 vertices, and twice that past them —
 * measured on the gate in `/docs/graph/layout`: at 500,000 the default square presses the layout
 * against its border and the communities mix.
 */
export const spaceFor = (size: number): number => (size > 200_000 ? 8192 : 4096);

/** A seeded `[0, 1)`: the same start for the same corpus, so a layout is reproducible. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * **Cosmograph's start**: a Gaussian around the square's centre, its spread growing with the graph up
 * to an eighth of the side — tight enough that the forces gather it in a few hundred ticks, wide
 * enough that a million points are not one pixel.
 */
function seeded(size: number, space: number): Float32Array {
  const next = random(size);
  const sigma = (space / 8) * Math.sqrt(Math.min(1, size / 1.5e6));
  const positions = new Float32Array(2 * size);
  for (let i = 0; i < size; i++) {
    const r = Math.sqrt(-2 * Math.log(1 - next())) * sigma;
    const theta = 2 * Math.PI * next();
    positions[2 * i] = space / 2 + r * Math.cos(theta);
    positions[2 * i + 1] = space / 2 + r * Math.sin(theta);
  }
  return positions;
}

function extentOf(positions: Float32Array): Geometry["extent"] {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 2) {
    const x = positions[i] as number;
    const y = positions[i + 1] as number;
    if (Number.isNaN(x) || Number.isNaN(y)) continue;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return x0 > x1 ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** The links, and the positions: two bound columns, or a seeded start for the layout. */
export async function loadGeometry(coordinator: Coordinator, structure: Structure, binding: Binding): Promise<Geometry> {
  const { size } = structure;
  const space = spaceFor(size);
  const bound = binding.x !== undefined && binding.y !== undefined;
  const [links, columns] = await Promise.all([
    readLinks(coordinator, structure),
    bound ? readColumns(coordinator, structure, [binding.x as string, binding.y as string]) : Promise.resolve([]),
  ]);
  if (!bound) return { structure, size, positions: seeded(size, space), bound, links, extent: null, space };
  const positions = new Float32Array(2 * size).fill(Number.NaN);
  for (const { table, answer } of columns) {
    const xs = answer.getChild(binding.x as string)?.toArray() ?? [];
    const ys = answer.getChild(binding.y as string)?.toArray() ?? [];
    for (let i = 0; i < answer.numRows; i++) {
      const at = 2 * (table.first + i);
      positions[at] = xs[i] === null ? Number.NaN : Number(xs[i]);
      positions[at + 1] = ys[i] === null ? Number.NaN : Number(ys[i]);
    }
  }
  return { structure, size, positions, bound, links, extent: extentOf(positions), space };
}

/** Each vertex's degree over every relation — the size a point takes when `r` is unbound. */
function degrees(size: number, links: Float32Array): Float32Array {
  const degree = new Float32Array(size);
  for (let i = 0; i < links.length; i++) {
    const id = links[i] as number;
    degree[id] = (degree[id] as number) + 1;
  }
  return degree;
}

/** The bound channels — category, size and cluster — over every vertex. */
export async function loadEncoding(
  coordinator: Coordinator,
  geometry: Geometry,
  binding: Binding,
  seed: readonly unknown[],
): Promise<Encoding> {
  const { structure, size } = geometry;
  const select = [binding.category, binding.size, binding.cluster].filter((c): c is string => c !== undefined);
  const answers = select.length > 0 ? await readColumns(coordinator, structure, [...new Set(select)]) : [];
  const dictionary = new Dictionary(seed);
  const codes = new Uint32Array(size);
  const sizes = binding.size === undefined ? degrees(size, geometry.links) : new Float32Array(size).fill(Number.NaN);
  const groups = binding.cluster === undefined ? null : new Dictionary();
  const clusters: (number | undefined)[] | null = groups ? new Array<number | undefined>(size) : null;
  if (binding.byTable) {
    for (const table of structure.vertices) codes.fill(dictionary.code(table.name), table.first, table.first + table.rows);
  } else if (binding.category === undefined) {
    codes.fill(dictionary.code(null));
  }
  for (const { table, answer } of answers) {
    const values = binding.category === undefined || binding.byTable ? undefined : answer.getChild(binding.category)?.toArray();
    const ramp = binding.size === undefined ? undefined : answer.getChild(binding.size)?.toArray();
    const cluster = binding.cluster === undefined ? undefined : answer.getChild(binding.cluster)?.toArray();
    for (let i = 0; i < answer.numRows; i++) {
      const id = table.first + i;
      if (values) codes[id] = dictionary.code(values[i] ?? null);
      if (ramp) sizes[id] = ramp[i] === null ? Number.NaN : Number(ramp[i]);
      if (cluster && clusters && groups) clusters[id] = cluster[i] === null ? undefined : groups.code(cluster[i]);
    }
  }
  const order = dictionary.ranks();
  const ranks = codes.map((code) => order[code] ?? 0);
  const domain: unknown[] = [];
  order.forEach((rank, code) => {
    domain[rank] = dictionary.values[code];
  });
  return { ranks, sizes, clusters, domain };
}
