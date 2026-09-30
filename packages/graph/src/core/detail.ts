import type { Corpus, VertexTable } from "@fossil-lang/corpus";
import type { Geometry } from "./load";
import type { VertexId } from "./types";

/** One vertex's row, as its table's properties order it — every column but the key and the position. */
export interface VertexDetail {
  readonly vertex: VertexId;
  /** The vertex table it belongs to. */
  readonly table: string;
  readonly fields: readonly { readonly name: string; readonly value: unknown }[];
}

const tableOf = (geometry: Geometry, vertex: VertexId): VertexTable | undefined =>
  vertex < geometry.size ? geometry.tables[geometry.table[vertex] as number] : undefined;

/**
 * **Detail is fetched, not carried.** The loaded graph holds positions and channels; the rest of a
 * row is asked for when a reader focuses the vertex — a scan of its table, filtered to its key.
 */
export async function readVertex(
  corpus: Corpus,
  geometry: Geometry,
  vertex: VertexId,
  signal?: AbortSignal,
): Promise<VertexDetail | null> {
  const table = tableOf(geometry, vertex);
  if (!table) return null;
  const hidden = new Set([table.key, table.position?.x, table.position?.y]);
  const names = table.properties.map((p) => p.name).filter((name) => !hidden.has(name));
  const scan = corpus.scan({ table: table.name, filter: { column: table.key, op: "=", value: vertex }, select: [table.key, ...names], limit: 1 });
  const rows = (await scan.read(scan.plan(), { signal })).find((batch) => batch.numRows > 0);
  if (!rows) return null;
  return {
    vertex,
    table: table.name,
    fields: names.map((name) => ({ name, value: rows.getChild(name)?.toArray()[0] ?? null })),
  };
}

/**
 * **A label's text, for the few vertices that carry one** — `title` where the vertex's table has the
 * column, and the table's declared `identity` where it does not. One scan per table they fall in.
 */
export async function readTitles(
  corpus: Corpus,
  geometry: Geometry,
  vertices: readonly VertexId[],
  title: string | undefined,
  signal?: AbortSignal,
): Promise<Map<VertexId, string>> {
  const byTable = new Map<VertexTable, VertexId[]>();
  for (const vertex of vertices) {
    const table = tableOf(geometry, vertex);
    if (table) byTable.set(table, [...(byTable.get(table) ?? []), vertex]);
  }
  const found = new Map<VertexId, string>();
  await Promise.all(
    [...byTable].map(async ([table, ids]) => {
      const column = title !== undefined && table.properties.some((p) => p.name === title) ? title : table.identity;
      const scan = corpus.scan({ table: table.name, filter: { column: table.key, op: "in", values: ids }, select: [table.key, column] });
      for (const batch of await scan.read(scan.plan(), { signal })) {
        const keys = batch.getChild(table.key)?.toArray() ?? [];
        const texts = batch.getChild(column)?.toArray() ?? [];
        for (let i = 0; i < batch.numRows; i++) found.set(Number(keys[i]), String(texts[i] ?? ""));
      }
    }),
  );
  return found;
}
