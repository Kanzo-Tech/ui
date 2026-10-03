import type { Coordinator } from "@kanzo-tech/mosaic";

/**
 * **What the graph reads, through the page's coordinator.** A corpus fossil's `open` attached under
 * a name is a catalog: a view per table, and the manifest as two relations — `fossil_tables` and
 * `fossil_columns`. The graph reads the structure from those and the rows from the views, with the
 * same coordinator — and the same cache — every chart on the page uses. Nothing here parses a
 * manifest and nothing here owns a connection.
 */

/** One vertex table: the `dense_id` range it holds, and what it can be asked for. */
export interface VertexTable {
  readonly name: string;
  /** Its first `dense_id`; its vertices are `first … first + rows − 1`. */
  readonly first: number;
  readonly rows: number;
  /** Every column, by name. */
  readonly columns: ReadonlySet<string>;
  /** The `identity` column — what a label falls back to. */
  readonly identity: string;
  /**
   * The program's own columns — every one the writer gave no role — with the type `fossil.json`
   * spells (`double`, `int32`, `string`, …). What a reader may bind a channel to: `dense_id` and the
   * identity are fossil's, not fields.
   */
  readonly fields: ReadonlyMap<string, string>;
}

/** One relation: its table, and the vertex tables its `src` and `dst` point into. */
export interface EdgeTable {
  readonly name: string;
  readonly source: string;
  readonly destination: string;
  readonly rows: number;
}

/** The attached corpus, as its two relations describe it. */
export interface Structure {
  /** The catalog `open` attached the corpus under. */
  readonly from: string;
  readonly vertices: readonly VertexTable[];
  readonly edges: readonly EdgeTable[];
  /** Every vertex, every table: `dense_id` runs `0 … size − 1`. */
  readonly size: number;
}

/** A quoted SQL identifier. */
export const ident = (name: string): string => `"${name.replace(/"/g, '""')}"`;
/** A single-quoted SQL string. */
export const lit = (value: string): string => `'${value.replace(/'/g, "''")}'`;
/** A table of the attached corpus, as SQL names it. */
export const relation = (from: string, table: string): string => `${ident(from)}.${ident(table)}`;

/** One column of an answer, by name, as its own array. */
export interface Answer {
  readonly numRows: number;
  getChild(name: string): { toArray(): ArrayLike<unknown>; get(index: number): unknown } | null;
}

/** Run `sql` on the coordinator, in Arrow. */
export const ask = (coordinator: Coordinator, sql: string): Promise<Answer> =>
  coordinator.query(sql, { type: "arrow" }) as Promise<Answer>;

const column = (answer: Answer, name: string): ArrayLike<unknown> => answer.getChild(name)?.toArray() ?? [];

/** `fossil_tables` and `fossil_columns`, read once per corpus. */
export async function readStructure(coordinator: Coordinator, from: string): Promise<Structure> {
  const [tables, columns] = await Promise.all([
    ask(coordinator, `SELECT table_name, kind, rows::DOUBLE AS rows, first_id::DOUBLE AS first_id, source, destination FROM ${relation(from, "fossil_tables")} ORDER BY first_id NULLS LAST, table_name`),
    ask(coordinator, `SELECT table_name, column_name, type, role FROM ${relation(from, "fossil_columns")} ORDER BY table_name, ordinal`),
  ]);
  const byTable = new Map<string, { names: Set<string>; identity: string; fields: Map<string, string> }>();
  const [tn, cn, type, role] = [column(columns, "table_name"), column(columns, "column_name"), column(columns, "type"), column(columns, "role")];
  for (let i = 0; i < columns.numRows; i++) {
    const entry = byTable.get(String(tn[i])) ?? { names: new Set<string>(), identity: "subject", fields: new Map<string, string>() };
    entry.names.add(String(cn[i]));
    if (role[i] === "identity") entry.identity = String(cn[i]);
    if (role[i] === null) entry.fields.set(String(cn[i]), String(type[i]));
    byTable.set(String(tn[i]), entry);
  }
  const name = column(tables, "table_name");
  const kind = column(tables, "kind");
  const rows = column(tables, "rows");
  const first = column(tables, "first_id");
  const source = column(tables, "source");
  const destination = column(tables, "destination");
  const vertices: VertexTable[] = [];
  const edges: EdgeTable[] = [];
  for (let i = 0; i < tables.numRows; i++) {
    const table = String(name[i]);
    if (kind[i] === "vertex") {
      const described = byTable.get(table);
      vertices.push({
        name: table,
        first: Number(first[i]),
        rows: Number(rows[i]),
        columns: described?.names ?? new Set(),
        identity: described?.identity ?? "subject",
        fields: described?.fields ?? new Map(),
      });
    } else {
      edges.push({ name: table, source: String(source[i]), destination: String(destination[i]), rows: Number(rows[i]) });
    }
  }
  return { from, vertices, edges, size: vertices.reduce((sum, v) => sum + v.rows, 0) };
}

/** The vertex table a `dense_id` falls in. */
export function tableOf(structure: Structure, vertex: number): VertexTable | undefined {
  return structure.vertices.find((t) => vertex >= t.first && vertex < t.first + t.rows);
}

/**
 * Each table's rows of `select`, in `dense_id` order — the table's slice of every buffer. A table
 * that lacks a selected column answers `null` for it, so one statement shape serves every table.
 */
export async function readColumns(
  coordinator: Coordinator,
  structure: Structure,
  select: readonly string[],
): Promise<{ table: VertexTable; answer: Answer }[]> {
  return Promise.all(
    structure.vertices.map(async (table) => {
      const projection = select.map((c) => (table.columns.has(c) ? `${ident(c)} AS ${ident(c)}` : `NULL AS ${ident(c)}`)).join(", ");
      const answer = await ask(coordinator, `SELECT ${projection} FROM ${relation(structure.from, table.name)} ORDER BY dense_id`);
      return { table, answer };
    }),
  );
}

/** `[src, dst, …]` over every relation, as cosmos.gl takes links. */
export async function readLinks(coordinator: Coordinator, structure: Structure): Promise<Float32Array> {
  const answers = await Promise.all(
    structure.edges.map((edge) => ask(coordinator, `SELECT src::DOUBLE AS src, dst::DOUBLE AS dst FROM ${relation(structure.from, edge.name)}`)),
  );
  const links = new Float32Array(2 * answers.reduce((sum, a) => sum + a.numRows, 0));
  let at = 0;
  for (const answer of answers) {
    const [src, dst] = [column(answer, "src"), column(answer, "dst")];
    for (let e = 0; e < answer.numRows; e++) {
      links[at++] = src[e] as number;
      links[at++] = dst[e] as number;
    }
  }
  return links;
}

/** The column a vertex's text is read from: `title` where its table has it, else its `identity`. */
export const titleColumn = (table: VertexTable, title: string | undefined): string =>
  title !== undefined && table.columns.has(title) ? title : table.identity;

/** One vertex's row, as its table orders it — every column but the address. */
export interface VertexDetail {
  readonly vertex: number;
  /** The vertex table it belongs to. */
  readonly table: string;
  readonly fields: readonly { readonly name: string; readonly value: unknown }[];
}

/** One vertex's row: every column but the address. */
export async function readVertex(coordinator: Coordinator, structure: Structure, vertex: number): Promise<VertexDetail | null> {
  const table = tableOf(structure, vertex);
  if (!table) return null;
  const answer = await ask(coordinator, `SELECT * EXCLUDE (dense_id) FROM ${relation(structure.from, table.name)} WHERE dense_id = ${vertex}`);
  if (answer.numRows === 0) return null;
  const names = [...table.columns].filter((name) => name !== "dense_id");
  return { vertex, table: table.name, fields: names.map((name) => ({ name, value: answer.getChild(name)?.get(0) ?? null })) };
}

/** The text of a few vertices, by id — a label's, a hover card's. One statement per table they fall in. */
export async function readTitles(
  coordinator: Coordinator,
  structure: Structure,
  vertices: readonly number[],
  title: string | undefined,
): Promise<Map<number, string>> {
  const byTable = new Map<VertexTable, number[]>();
  for (const vertex of vertices) {
    const table = tableOf(structure, vertex);
    if (table) byTable.set(table, [...(byTable.get(table) ?? []), vertex]);
  }
  const found = new Map<number, string>();
  await Promise.all(
    [...byTable].map(async ([table, ids]) => {
      const text = titleColumn(table, title);
      const answer = await ask(
        coordinator,
        `SELECT dense_id::DOUBLE AS id, ${ident(text)}::VARCHAR AS text FROM ${relation(structure.from, table.name)} WHERE dense_id IN (${ids.join(", ")})`,
      );
      const [id, texts] = [column(answer, "id"), column(answer, "text")];
      for (let i = 0; i < answer.numRows; i++) found.set(id[i] as number, String(texts[i] ?? ""));
    }),
  );
  return found;
}

/**
 * **Vertices whose text contains `query`**, case-insensitively, `limit` at most — Cosmograph's search,
 * a `LIKE` per table in one statement. Nothing is read until the reader types.
 */
export async function searchTitles(
  coordinator: Coordinator,
  structure: Structure,
  query: string,
  title: string | undefined,
  limit: number,
): Promise<{ id: number; text: string }[]> {
  if (structure.vertices.length === 0) return [];
  const needle = lit(`%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  const union = structure.vertices
    .map((table) => {
      const text = `${ident(titleColumn(table, title))}::VARCHAR`;
      return `SELECT dense_id::DOUBLE AS id, ${text} AS text FROM ${relation(structure.from, table.name)} WHERE ${text} ILIKE ${needle} ESCAPE '\\'`;
    })
    .join(" UNION ALL ");
  const answer = await ask(coordinator, `SELECT * FROM (${union}) ORDER BY length(text), text LIMIT ${limit}`);
  const [id, text] = [column(answer, "id"), column(answer, "text")];
  return Array.from({ length: answer.numRows }, (_, i) => ({ id: id[i] as number, text: String(text[i] ?? "") }));
}
