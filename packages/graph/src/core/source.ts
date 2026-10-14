import {
  Query,
  and,
  asTableRef,
  cast,
  count,
  eq,
  float64,
  isIn,
  length,
  literal,
  not,
  sql,
  sum,
  clauseColumns,
  type Coordinator,
  type ExprNode,
  type FilterExpr,
} from "@kanzo-tech/mosaic";
import { DST, KEY, SRC, VERTEX_INDEX, tableOf, type Structure, type VertexTable } from "./structure";

/**
 * **What the graph reads, through the page's coordinator.** A GraphAr graph `attachGraph` attached
 * under a name is a catalog: a view per vertex and edge type, and the information files as relations
 * beside them. The graph reads the structure from those once (`readCatalog`, `catalog.ts`) and the
 * rows here, through each type's `table` — its view under the global id — with the same coordinator,
 * and the same cache, every chart on the page uses. Nothing here parses a YAML file and nothing here
 * owns a connection.
 *
 * Every statement is built from mosaic-sql's nodes, which quote their own identifiers and literals:
 * a search is text a reader typed, and no string here is spliced into SQL.
 */

/** A relation of the attached graph: `"<from>"."<table>"`. `asTableRef` answers `undefined` only for no input. */
export const relation = (from: string, table: string): ExprNode => asTableRef([from, table])!;

/** One column of an answer, by name, as its own array. */
export interface Answer {
  readonly numRows: number;
  getChild(name: string): { toArray(): ArrayLike<unknown>; get(index: number): unknown } | null;
}

/** Run `query` on the coordinator, in Arrow. */
export const ask = (coordinator: Coordinator, query: Query): Promise<Answer> =>
  coordinator.query(query, { type: "arrow" }) as Promise<Answer>;

const values = (answer: Answer, name: string): ArrayLike<unknown> => answer.getChild(name)?.toArray() ?? [];

/**
 * Each table's rows of `select`, in the key's order — the table's slice of every buffer. A table
 * that lacks a selected column answers `null` for it, so one statement shape serves every table.
 */
export async function readColumns(
  coordinator: Coordinator,
  structure: Structure,
  select: readonly string[],
): Promise<{ table: VertexTable; answer: Answer }[]> {
  return Promise.all(
    structure.vertices.map(async (table) => {
      const projection = Object.fromEntries(select.map((c) => [c, table.columns.has(c) ? c : literal(null)]));
      const answer = await ask(coordinator, Query.select(projection).from(table.table).orderby(KEY));
      return { table, answer };
    }),
  );
}

/** `[src, dst, …]` over every relation, as cosmos.gl takes links. */
export async function readLinks(coordinator: Coordinator, structure: Structure): Promise<Float32Array> {
  const answers = await Promise.all(
    structure.edges.map((edge) =>
      ask(
        coordinator,
        Query.select({ src: float64(SRC), dst: float64(DST) }).from(edge.table),
      ),
    ),
  );
  const links = new Float32Array(2 * answers.reduce((sum, a) => sum + a.numRows, 0));
  let at = 0;
  for (const answer of answers) {
    const [src, dst] = [values(answer, "src"), values(answer, "dst")];
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

/**
 * One vertex's row: every column but the global id. A lookup by id reads the type's view by
 * GraphAr's own index, `id − first`, which the chunk's statistics can skip on, and not by the sum.
 */
export async function readVertex(coordinator: Coordinator, structure: Structure, vertex: number): Promise<VertexDetail | null> {
  const table = tableOf(structure, vertex);
  if (!table) return null;
  const names = [...table.columns.keys()].filter((name) => name !== KEY);
  const answer = await ask(
    coordinator,
    Query.select(names).from(relation(structure.from, table.name)).where(eq(VERTEX_INDEX, literal(vertex - table.first))),
  );
  if (answer.numRows === 0) return null;
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
      const answer = await ask(
        coordinator,
        Query.select({ id: float64(VERTEX_INDEX), text: cast(titleColumn(table, title), "VARCHAR") })
          .from(relation(structure.from, table.name))
          .where(isIn(VERTEX_INDEX, ids.map((id) => literal(id - table.first)))),
      );
      const [id, texts] = [values(answer, "id"), values(answer, "text")];
      for (let i = 0; i < answer.numRows; i++) found.set(table.first + (id[i] as number), String(texts[i] ?? ""));
    }),
  );
  return found;
}

/**
 * **A search, as typed** — Neo4j Bloom's prefixes over Cosmograph's search. `type:<Type>` keeps a
 * vertex table by name; `<column>:<value>` keeps the vertices whose column contains the value; every
 * other word is text the vertex's `title` must contain. A word is a prefix only when what precedes
 * its colon is `type` or a column some vertex table has, so an IRI typed whole stays text.
 */
export interface VertexQuery {
  readonly text: string;
  /** Vertex tables, by name; none is every table. */
  readonly types: readonly string[];
  /** Columns and what each must contain, every one of them. */
  readonly fields: readonly { readonly column: string; readonly value: string }[];
}

const same = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0;
const columnOf = (table: VertexTable, name: string) => [...table.columns.keys()].find((c) => same(c, name));

/** `input` read as a {@link VertexQuery}. A prefix with nothing after its colon yet asks for nothing. */
export function parseQuery(input: string, structure: Structure): VertexQuery {
  const text: string[] = [];
  const types: string[] = [];
  const fields: { column: string; value: string }[] = [];
  for (const word of input.trim().split(/\s+/)) {
    const [, key = "", value = ""] = /^([^:]+):(.*)$/.exec(word) ?? [];
    if (same(key, "type")) {
      if (value !== "") types.push(value);
    } else if (key !== "" && structure.vertices.some((table) => columnOf(table, key) !== undefined)) {
      if (value !== "") fields.push({ column: key, value });
    } else if (word !== "") {
      text.push(word);
    }
  }
  return { text: text.join(" "), types, fields };
}

/** `expr` contains `value`, case-insensitively, with a `%` or `_` in it meaning itself. */
const ilike = (expr: ExprNode | string, value: string): ExprNode =>
  sql`${cast(expr, "VARCHAR")} ILIKE ${literal(`%${value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)} ESCAPE ${literal("\\")}`;

/**
 * **The clause rule**: a table answers a clause when it has every column the clause names on it — a
 * semi-join on the key names that alone, so every table answers it.
 */
export function answers(table: VertexTable, clause: ExprNode): boolean {
  return clauseColumns(clause).every((c) => table.columns.has(c));
}

/** The clauses of a predicate, as a list: a selection's `predicate` answers one, many or none. */
export function clausesOf(filter: FilterExpr | null | undefined): ExprNode[] {
  // What a selection publishes is a node per clause; a predicate is never a bare string or boolean here.
  return (Array.isArray(filter) ? filter : [filter]).filter((c) => c !== undefined && c !== null) as ExprNode[];
}

/**
 * Every vertex `query` keeps — `id`, `text` and `type`, its table — as one `UNION ALL` over the tables
 * that can answer it, with `inside` saying whether the subset keeps it: every clause, by the clause
 * rule, so a table that cannot answer one of them is wholly outside. A table outside `types`,
 * or without a column a field names, is not asked, and `null` is no table left to ask.
 */
function matching(structure: Structure, query: VertexQuery, title: string | undefined, subset: readonly ExprNode[]): Query | null {
  const selects = structure.vertices.flatMap((table) => {
    if (query.types.length > 0 && !query.types.some((type) => same(type, table.name))) return [];
    const fields = query.fields.map((field) => ({ name: columnOf(table, field.column), value: field.value }));
    if (fields.some((field) => field.name === undefined)) return [];
    const text = cast(titleColumn(table, title), "VARCHAR");
    const where = [
      ...(query.text === "" ? [] : [ilike(text, query.text)]),
      ...fields.map((field) => ilike(field.name as string, field.value)),
    ];
    // A clause the table cannot answer keeps none of it (`/docs/design/crossfilter#formal-semantics`).
    const inside = subset.length === 0 ? literal(true) : subset.every((clause) => answers(table, clause)) ? and(...subset) : literal(false);
    return [
      Query.select({ id: float64(KEY), text, key: cast(table.identity, "VARCHAR"), type: literal(table.name), inside })
        .from(table.table)
        .where(where),
    ];
  });
  return selects.length === 0 ? null : Query.unionAll(selects);
}

/**
 * What a search answered: the first matches, and how many the limit hid, in all and per table. A
 * match carries its identity as `key` beside its `text`, because a title is not unique and fifty rows
 * reading "scout" are one row fifty times until something tells them apart.
 */
export interface Found {
  readonly matches: readonly { readonly id: number; readonly text: string; readonly key: string; readonly type: string }[];
  readonly total: number;
  readonly byType: ReadonlyMap<string, number>;
  /** How many matches the subset leaves out: found, but not listed. */
  readonly outside: number;
}

/**
 * **The first `limit` vertices `query` keeps inside `subset`**, shortest text first — one statement,
 * whose counts are windows, taken before the `LIMIT` applies: the matches inside, per type and in
 * all, and how many the subset leaves out. The inside rows sort first, so a search with none inside
 * still answers a row to count the outside from. Nothing is read until the reader types.
 */
export async function searchVertices(
  coordinator: Coordinator,
  structure: Structure,
  { query, title, limit, subset }: { query: VertexQuery; title?: string; limit: number; subset: readonly ExprNode[] },
): Promise<Found> {
  const union = matching(structure, query, title, subset);
  if (union === null) return { matches: [], total: 0, byType: new Map(), outside: 0 };
  // As a number: Arrow hands a boolean column back bit-packed.
  const one = float64(sql`CASE WHEN inside THEN 1 ELSE 0 END`);
  const answer = await ask(
    coordinator,
    Query.select("id", "text", "key", "type", {
      inside: one,
      per: float64(count().partitionby("type", "inside")),
      total: float64(sum(one).window()),
      all: float64(count().window()),
    })
      .from(union)
      .orderby(not("inside"), length("text"), "text", "id")
      .limit(limit),
  );
  const [id, text, key, type, inside] = ["id", "text", "key", "type", "inside"].map((name) => values(answer, name));
  const [per, total, all] = ["per", "total", "all"].map((name) => values(answer, name));
  const byType = new Map<string, number>();
  const matches = Array.from({ length: answer.numRows }, (_, i) => i)
    .filter((i) => inside?.[i])
    .map((i) => {
      byType.set(String(type?.[i]), Number(per?.[i]));
      return { id: id?.[i] as number, text: String(text?.[i] ?? ""), key: String(key?.[i] ?? ""), type: String(type?.[i]) };
    });
  if (answer.numRows === 0) return { matches, total: 0, byType, outside: 0 };
  return { matches, total: Number(total?.[0]), byType, outside: Number(all?.[0]) - Number(total?.[0]) };
}

/** Every vertex `query` keeps inside `subset`, by id — what a search adds to the subset. */
export async function matchingIds(
  coordinator: Coordinator,
  structure: Structure,
  query: VertexQuery,
  { title, subset }: { title?: string; subset: readonly ExprNode[] },
): Promise<number[]> {
  const union = matching(structure, query, title, subset);
  if (union === null) return [];
  return Array.from(values(await ask(coordinator, Query.select("id").from(union).where("inside")), "id") as ArrayLike<number>);
}

/** The name every vertex as one relation goes by: in the corpus's join graph, and as what the canvas reads. */
export const VERTICES = "vertices";

const unions = new WeakMap<Structure, { table: Query; columns: string[] }>();

/**
 * **Every vertex as one relation** — each vertex type's rows under the global id, with every
 * column some table has: `NULL` in a table without it, so a clause on a column keeps none of a type
 * that has no such column (`/docs/design/crossfilter`). A column two tables declare with different
 * types is not one column, and is left out. What the canvas reads, what a timeline over the graph
 * counts (`<ChartTimeline relation="vertices" field=… />`), and the `vertices` type of the corpus's
 * join graph.
 */
export function verticesOf(structure: Structure): { table: Query; columns: string[] } {
  const found = unions.get(structure);
  if (found) return found;
  const types = new Map<string, string | null>();
  for (const table of structure.vertices) {
    for (const [name, column] of table.columns) {
      if (name === KEY) continue;
      const seen = types.get(name);
      types.set(name, seen === undefined || seen === column.type ? column.type : null);
    }
  }
  const columns = [...types].flatMap(([name, type]) => (type === null ? [] : [name]));
  const table = Query.unionAll(
    structure.vertices.map((t) =>
      Query.select({ [KEY]: KEY, ...Object.fromEntries(columns.map((c) => [c, t.columns.has(c) ? c : literal(null)])) }).from(t.table),
    ),
  );
  const union = { table, columns };
  unions.set(structure, union);
  return union;
}
