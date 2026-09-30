import { Dictionary } from "./categories";
import { projectionOf, type Binding } from "./channels";
import type { Batch, Corpus, EdgeTable, Filter, VertexTable } from "./corpus-contract";
import { columnsOf } from "./filter";

/**
 * **The whole graph, read once and laid out as cosmos.gl's buffers.** A drawn vertex's `dense_id` is
 * its index, so every array is sized from the manifest's `record_count`s before a row arrives, and a
 * row is written where its id says. The camera never reaches here: nothing is read because it moved.
 */

/** Where the drawn vertices are and how they connect — read once per corpus. */
export interface Geometry {
  /** The vertex tables with a position, in the manifest's order. */
  readonly tables: readonly VertexTable[];
  /** Drawn vertices: ids `0 … size − 1`. */
  readonly size: number;
  /** `[x, y, …]` by id; `NaN` where no row has a position. */
  readonly positions: Float32Array;
  /** By id, the vertex's index in `tables`. */
  readonly table: Uint16Array;
  /** `[src, dst, …]` by id, every relation whose two ends are drawn. */
  readonly links: Float32Array;
  readonly extent: { readonly x: number; readonly y: number; readonly w: number; readonly h: number } | null;
}

/** What the bound channels say about each vertex — read again when a binding changes. */
export interface Encoding {
  /** By id, the category's rank. */
  readonly ranks: Uint32Array;
  /** By id, the ramp's raw value, or `null` when `r` is unbound. */
  readonly sizes: Float32Array | null;
  /** What each rank is: the seed, then the other values seen, in rank order. */
  readonly domain: readonly unknown[];
}

/** The vertex tables fossil lays out or the program places; a table without a position is not drawn. */
export const drawnTables = (corpus: Corpus): VertexTable[] => corpus.manifest.vertex_tables.filter((table) => table.position);

const has = (table: VertexTable) => (column: string) => table.properties.some((p) => p.name === column);

async function readAll(corpus: Corpus, params: Parameters<Corpus["scan"]>[0], signal: AbortSignal): Promise<readonly Batch[]> {
  const scan = corpus.scan(params);
  return scan.read(scan.plan(), { signal });
}

function encoder(tables: readonly VertexTable[], size: number, binding: Binding, seed: readonly unknown[]) {
  const dictionary = new Dictionary(seed);
  const codes = new Uint32Array(size);
  const sizes = binding.size === undefined ? null : new Float32Array(size).fill(Number.NaN);
  return {
    add(t: number, batch: Batch) {
      const table = tables[t] as VertexTable;
      const ids = batch.getChild(table.key)?.toArray() ?? [];
      const values = binding.category === undefined ? undefined : batch.getChild(binding.category)?.toArray();
      const ramp = binding.size === undefined ? undefined : batch.getChild(binding.size)?.toArray();
      const own = binding.byTable ? dictionary.code(table.name) : 0;
      for (let i = 0; i < batch.numRows; i++) {
        const id = Number(ids[i]);
        if (!(id < size)) continue;
        codes[id] = binding.byTable || binding.category === undefined ? own : dictionary.code(values?.[i] ?? null);
        if (sizes) sizes[id] = Number(ramp?.[i] ?? Number.NaN);
      }
    },
    finish(): Encoding {
      const order = dictionary.ranks();
      const ranks = codes.map((code) => order[code] ?? 0);
      const domain: unknown[] = [];
      order.forEach((rank, code) => {
        domain[rank] = dictionary.values[code];
      });
      return { ranks, sizes, domain };
    },
  };
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

async function readLinks(corpus: Corpus, tables: readonly VertexTable[], size: number, signal: AbortSignal): Promise<Float32Array> {
  const drawn = new Set(tables.map((table) => table.name));
  const relations = corpus.manifest.edge_tables.filter(
    (edge: EdgeTable) => drawn.has(edge.source.references) && drawn.has(edge.destination.references),
  );
  const answers = await Promise.all(
    relations.map((edge) => readAll(corpus, { table: edge.name, select: [edge.source.key, edge.destination.key] }, signal)),
  );
  const links = new Float32Array(2 * relations.reduce((sum, edge) => sum + edge.record_count, 0));
  let at = 0;
  answers.forEach((batches, r) => {
    const edge = relations[r] as EdgeTable;
    for (const batch of batches) {
      const src = batch.getChild(edge.source.key)?.toArray() ?? [];
      const dst = batch.getChild(edge.destination.key)?.toArray() ?? [];
      for (let e = 0; e < batch.numRows && at < links.length; e++) {
        const a = Number(src[e]);
        const b = Number(dst[e]);
        if (!(a < size && b < size)) continue;
        links[at++] = a;
        links[at++] = b;
      }
    }
  });
  return at === links.length ? links : links.slice(0, at);
}

/** One scan per drawn table and one per relation between them, read whole, in parallel. */
export async function loadGraph(
  corpus: Corpus,
  binding: Binding,
  seed: readonly unknown[],
  signal: AbortSignal,
): Promise<{ geometry: Geometry; encoding: Encoding }> {
  const tables = drawnTables(corpus);
  const size = tables.reduce((sum, table) => sum + table.record_count, 0);
  const positions = new Float32Array(2 * size).fill(Number.NaN);
  const table = new Uint16Array(size);
  const encode = encoder(tables, size, binding, seed);
  const [vertices, links] = await Promise.all([
    Promise.all(
      tables.map((t) => {
        const { x, y } = t.position as NonNullable<VertexTable["position"]>;
        return readAll(corpus, { table: t.name, select: projectionOf(binding, [t.key, x, y], has(t)) }, signal);
      }),
    ),
    readLinks(corpus, tables, size, signal),
  ]);
  vertices.forEach((batches, t) => {
    const { key, position } = tables[t] as VertexTable;
    for (const batch of batches) {
      const ids = batch.getChild(key)?.toArray() ?? [];
      const xs = batch.getChild(position?.x ?? "")?.toArray() ?? [];
      const ys = batch.getChild(position?.y ?? "")?.toArray() ?? [];
      for (let i = 0; i < batch.numRows; i++) {
        const id = Number(ids[i]);
        if (!(id < size)) continue;
        positions[id * 2] = Number(xs[i] ?? Number.NaN);
        positions[id * 2 + 1] = Number(ys[i] ?? Number.NaN);
        table[id] = t;
      }
      encode.add(t, batch);
    }
  });
  return { geometry: { tables, size, positions, table, links, extent: extentOf(positions) }, encoding: encode.finish() };
}

/** A new binding re-reads the channels and nothing else: the positions and the links stay uploaded. */
export async function loadEncoding(
  corpus: Corpus,
  geometry: Geometry,
  binding: Binding,
  seed: readonly unknown[],
  signal: AbortSignal,
): Promise<Encoding> {
  const { tables, size } = geometry;
  const encode = encoder(tables, size, binding, seed);
  const answers = await Promise.all(
    tables.map((t) => readAll(corpus, { table: t.name, select: projectionOf(binding, [t.key], has(t)) }, signal)),
  );
  answers.forEach((batches, t) => {
    for (const batch of batches) encode.add(t, batch);
  });
  return encode.finish();
}

/** What a filter kept: per table that holds every column it names, the surviving ids. */
export interface Kept {
  readonly filtered: ReadonlySet<number>;
  readonly ids: readonly number[];
}

/**
 * **A predicate, applied as a mask.** A table that lacks a column the filter names is not filtered,
 * which is what a `WHERE` over a union of the tables would do; a filter no drawn table can answer at
 * all is refused, so the unfiltered picture is never drawn as the filtered one.
 */
export async function readKept(corpus: Corpus, tables: readonly VertexTable[], filter: Filter, signal: AbortSignal): Promise<Kept> {
  const columns = columnsOf(filter);
  const filtered = tables.flatMap((table, t) => (columns.every(has(table)) ? [t] : []));
  if (filtered.length === 0) {
    throw new Error(`no drawn vertex type has every column this filter names: ${columns.join(", ")}`);
  }
  const answers = await Promise.all(
    filtered.map((t) => readAll(corpus, { table: (tables[t] as VertexTable).name, filter, select: [(tables[t] as VertexTable).key] }, signal)),
  );
  const ids: number[] = [];
  answers.forEach((batches, i) => {
    const { key } = tables[filtered[i] as number] as VertexTable;
    for (const batch of batches) {
      const column = batch.getChild(key)?.toArray() ?? [];
      for (let r = 0; r < batch.numRows; r++) ids.push(Number(column[r]));
    }
  });
  return { filtered: new Set(filtered), ids };
}

/** `1` where a vertex survives the page's filter. */
export function maskOf(geometry: Geometry, kept: Kept): Uint8Array {
  const mask = new Uint8Array(geometry.size);
  for (let id = 0; id < geometry.size; id++) mask[id] = kept.filtered.has(geometry.table[id] as number) ? 0 : 1;
  for (const id of kept.ids) if (id < geometry.size) mask[id] = 1;
  return mask;
}
