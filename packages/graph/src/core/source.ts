import {
  Query,
  and,
  asc,
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
import { GraphError } from "./error";
import { tableOf, type Column, type EdgeTable, type Structure, type VertexTable } from "./structure";

/**
 * **What the graph reads, through the page's coordinator.** A corpus fossil's `open` attached under
 * a name is a catalog: a view per table, and the manifest as two relations — `fossil_tables` and
 * `fossil_columns`. The graph reads the structure from those and the rows from the views, with the
 * same coordinator — and the same cache — every chart on the page uses. Nothing here parses a
 * manifest and nothing here owns a connection.
 *
 * Every statement is built from mosaic-sql's nodes, which quote their own identifiers and literals:
 * a search is text a reader typed, and no string here is spliced into SQL.
 */

/** A table of the attached corpus: `"<from>"."<table>"`. `asTableRef` answers `undefined` only for no input. */
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

const labelOf = (name: string, source: string, destination: string): string =>
  name.length > source.length + destination.length + 2 && name.startsWith(`${source}_`) && name.endsWith(`_${destination}`)
    ? name.slice(source.length + 1, name.length - destination.length - 1)
    : name;

/** `fossil_tables` and `fossil_columns`, read once per corpus. */
export async function readStructure(coordinator: Coordinator, from: string): Promise<Structure> {
  const [tables, columns] = await Promise.all([
    ask(
      coordinator,
      Query.select("table_name", "kind", "source", "destination", { rows: float64("rows"), first_id: float64("first_id") })
        .from(relation(from, "fossil_tables"))
        .orderby(asc("first_id", false), "table_name"),
    ),
    ask(
      coordinator,
      Query.select("table_name", "column_name", "role", { type: cast("type", "VARCHAR") })
        .from(relation(from, "fossil_columns"))
        .orderby("table_name", "ordinal"),
    ),
  ]);
  const byTable = new Map<string, { names: Map<string, Column>; identity: string }>();
  const [tn, cn] = [values(columns, "table_name"), values(columns, "column_name")];
  const [role, type] = [values(columns, "role"), values(columns, "type")];
  let key: string | undefined;
  for (let i = 0; i < columns.numRows; i++) {
    const entry = byTable.get(String(tn[i])) ?? { names: new Map<string, Column>(), identity: "subject" };
    entry.names.set(String(cn[i]), { type: String(type[i] ?? ""), role: role[i] === null ? null : String(role[i]) });
    if (role[i] === "identity") entry.identity = String(cn[i]);
    if (role[i] === "address") key ??= String(cn[i]);
    byTable.set(String(tn[i]), entry);
  }
  const name = values(tables, "table_name");
  const kind = values(tables, "kind");
  const rows = values(tables, "rows");
  const first = values(tables, "first_id");
  const [source, destination] = [values(tables, "source"), values(tables, "destination")];
  const vertices: VertexTable[] = [];
  const edges: EdgeTable[] = [];
  // Each kind by name: a `property` table — a multi-valued property, one row per value — is
  // neither a type nor a relation, and a kind this reader does not know is not one either.
  for (let i = 0; i < tables.numRows; i++) {
    const table = String(name[i]);
    if (kind[i] === "vertex") {
      const described = byTable.get(table);
      vertices.push({
        name: table,
        first: Number(first[i]),
        rows: Number(rows[i]),
        columns: described?.names ?? new Map(),
        identity: described?.identity ?? "subject",
      });
    } else if (kind[i] === "edge") {
      const [src, dst] = [String(source[i]), String(destination[i])];
      edges.push({ name: table, label: labelOf(table, src, dst), source: src, destination: dst, rows: Number(rows[i]) });
    }
  }
  if (key === undefined && vertices.length > 0) {
    throw new GraphError("graph/nothing-to-draw", `the corpus attached as ${from} gives no column the address role`);
  }
  return { from, key: key ?? "", vertices, edges, size: vertices.reduce((sum, v) => sum + v.rows, 0) };
}

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
      const answer = await ask(coordinator, Query.select(projection).from(relation(structure.from, table.name)).orderby(structure.key));
      return { table, answer };
    }),
  );
}

/** `[src, dst, …]` over every relation, as cosmos.gl takes links. */
export async function readLinks(coordinator: Coordinator, structure: Structure): Promise<Float32Array> {
  const answers = await Promise.all(
    structure.edges.map((edge) =>
      ask(coordinator, Query.select({ src: float64("src"), dst: float64("dst") }).from(relation(structure.from, edge.name))),
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

/** One vertex's row: every column but the address. */
export async function readVertex(coordinator: Coordinator, structure: Structure, vertex: number): Promise<VertexDetail | null> {
  const table = tableOf(structure, vertex);
  if (!table) return null;
  const names = [...table.columns.keys()].filter((name) => name !== structure.key);
  const answer = await ask(
    coordinator,
    Query.select(names).from(relation(structure.from, table.name)).where(eq(structure.key, literal(vertex))),
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
        Query.select({ id: float64(structure.key), text: cast(titleColumn(table, title), "VARCHAR") })
          .from(relation(structure.from, table.name))
          .where(isIn(structure.key, ids.map((id) => literal(id)))),
      );
      const [id, texts] = [values(answer, "id"), values(answer, "text")];
      for (let i = 0; i < answer.numRows; i++) found.set(id[i] as number, String(texts[i] ?? ""));
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
 * that can answer it, with `inside` saying whether the subset keeps it: the clauses a table answers,
 * by the clause rule; a table that answers none of them is wholly inside. A table outside `types`,
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
    const kept = subset.filter((clause) => answers(table, clause));
    const inside = kept.length === 0 ? literal(true) : and(...kept);
    return [
      Query.select({ id: float64(structure.key), text, key: cast(table.identity, "VARCHAR"), type: literal(table.name), inside })
        .from(relation(structure.from, table.name))
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

