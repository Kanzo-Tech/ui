import type { EdgeType, Graph, Property, VertexType } from "@kanzo-tech/graphar-duckdb";
import { Query, and, cast, clauseColumns, float64, isIn, literal, sql, verbatim, type ExprNode, type FilterExpr, type Relation } from "@kanzo-tech/mosaic";
import { type Engine } from "@kanzo-tech/mosaic/engine";

/**
 * **What the graph reads.** The host attaches the graph and hands its `Graph` over; every read of a
 * vertex, of the links and of a search is the `Graph`'s own — `vertex`, `links`, `search` — and
 * every column a statement here names is one the `Graph` named: a type's `table` and `index`, a
 * property's `name`. Nothing here knows the format.
 *
 * What is the graph's own is the one number per vertex a GPU buffer and a semi-join across types
 * need: the global id, `dense_id`, a type's first id plus the vertex's index within its type, the
 * types in the graph's order. GraphAr defines no id across types; this is kanzo-ui's arithmetic, kept
 * here and nowhere else, and the union of every vertex under it (`verticesOf`).
 */

/** The global id, the key the canvas and its clauses read every vertex by. */
export const KEY = "dense_id";

/** The name the union of every vertex goes by: the relation the canvas reads and publishes on. */
export const VERTICES = "vertices";

/** A vertex type and the first global id of its vertices: they run `first … first + count − 1`. */
export interface Placed {
  readonly type: VertexType;
  readonly first: number;
}

const placings = new WeakMap<Graph, readonly Placed[]>();

/** Every vertex type with its first global id, in the graph's order. */
export function placed(graph: Graph): readonly Placed[] {
  let found = placings.get(graph);
  if (!found) {
    let first = 0;
    found = graph.vertexTypes.map((type) => {
      const at = { type, first };
      first += type.count;
      return at;
    });
    placings.set(graph, found);
  }
  return found;
}

/** Every vertex, every type: global ids run `0 … size − 1`. */
export const sizeOf = (graph: Graph): number => graph.vertexTypes.reduce((size, type) => size + type.count, 0);

/** The vertex type a global id falls in, with its first id. */
export function tableOf(graph: Graph, vertex: number): Placed | undefined {
  return placed(graph).find(({ type, first }) => vertex >= first && vertex < first + type.count);
}

/** A type's first global id. */
export const firstOf = (graph: Graph, type: string): number => placed(graph).find((p) => p.type.type === type)?.first ?? 0;

/** A type's property by name. */
export const propertyOf = (type: VertexType | EdgeType, name: string): Property | undefined => type.properties.find((p) => p.name === name);

/** The property a vertex is told apart by — its type's primary key — or `undefined` where it has none. */
export const identityOf = (type: VertexType): string | undefined => type.properties.find((p) => p.primary)?.name;

/**
 * An identity's local name — what follows its last `#` or `/`: RDF's syntactic split of an IRI, not
 * a guess. An identity that is no IRI answers itself.
 */
export const localName = (identity: string) => /[^#/]+(?=[#/]*$)/.exec(identity)?.[0] ?? identity;

/** A type's rows under the global id: `dense_id`, then every property by its own name. */
export function rowsOf({ type, first }: Placed): Query {
  return Query.select({ [KEY]: cast(sql`${first} + ${asColumn(type.index)}`, "UINTEGER") }, type.properties.map((p) => p.name)).from(verbatim(type.table));
}

/** A column the `Graph` named, quoted. */
const asColumn = (name: string) => `"${name.replace(/"/g, '""')}"`;

/**
 * **Every vertex as one relation of the page** — each type's rows under the global id, with every
 * property some type has (`NULL` in a type without it; one two types type differently is left out),
 * carrying each type's vertex as its index where the row is of it. A clause on any relation crosses
 * into it by type, and one on it into any relation that carries a vertex. One graph's is one object,
 * so a part handed it — `<ChartTimeline relation={verticesOf(graph)} />` — reads the canvas's relation.
 */
export function verticesOf(graph: Graph): Relation {
  let found = unions.get(graph);
  if (!found) unions.set(graph, (found = unionOf(graph)));
  return found;
}

const unions = new WeakMap<Graph, Relation>();

function unionOf(graph: Graph): Relation {
  const types = new Map<string, string | null>();
  for (const { properties } of graph.vertexTypes) {
    for (const { name, type } of properties) {
      const seen = types.get(name);
      types.set(name, seen === undefined || seen === type ? type : null);
    }
  }
  const names = [...types].flatMap(([name, type]) => (type === null || name === KEY ? [] : [name]));
  const table = Query.unionAll(
    placed(graph).map((at) =>
      Query.select({ [KEY]: KEY, ...Object.fromEntries(names.map((c) => [c, propertyOf(at.type, c) ? c : literal(null)])) }).from(rowsOf(at)),
    ),
  );
  const vertices = placed(graph).map(({ type, first }) => ({
    type: type.type,
    index: sql`CASE WHEN ${asColumn(KEY)} BETWEEN ${first} AND ${first + type.count - 1} THEN ${asColumn(KEY)} - ${first} END`,
  }));
  return { key: VERTICES, table, vertices, roots: vertices };
}

/** One column of an answer, by name, as its own array. */
export interface Answer {
  readonly numRows: number;
  getChild(name: string): { toArray(): ArrayLike<unknown>; get(index: number): unknown } | null;
}

/** What a read handed no signal waits on: one that never aborts. */
const UNSTOPPED = new AbortController().signal;

/**
 * Run `query` on the engine, in columns. An abort while it waits its turn means it is never sent;
 * while it runs, the engine interrupts it; either way the call rejects with the signal's reason.
 */
export function ask(engine: Engine, query: Query, signal: AbortSignal = UNSTOPPED): Promise<Answer> {
  return engine.query(String(query), { signal });
}

/**
 * Each type's rows of `select`, in the global id's order — the type's slice of every buffer. A type
 * that lacks a selected property answers `null` for it, so one statement shape serves every type.
 */
export async function readColumns(
  engine: Engine,
  graph: Graph,
  select: readonly string[],
  signal?: AbortSignal,
): Promise<{ table: Placed; answer: Answer }[]> {
  return Promise.all(
    placed(graph).map(async (table) => {
      const projection = Object.fromEntries(select.map((c) => [c, propertyOf(table.type, c) ? c : literal(null)]));
      const answer = await ask(engine, Query.select(projection).from(rowsOf(table)).orderby(KEY), signal);
      return { table, answer };
    }),
  );
}

/** `[src, dst, …]` in global ids over every edge type, as cosmos.gl takes links: `Graph.links`, placed. */
export async function readLinks(graph: Graph, signal?: AbortSignal): Promise<Float32Array> {
  const read = await Promise.all(graph.edgeTypes.map((edge) => graph.links(edge.name, { signal })));
  const links = new Float32Array(2 * read.reduce((sum, l) => sum + l.src.length, 0));
  let at = 0;
  graph.edgeTypes.forEach((edge, e) => {
    const { src, dst } = read[e]!;
    const [from, to] = [firstOf(graph, edge.srcType), firstOf(graph, edge.dstType)];
    for (let i = 0; i < src.length; i++) {
      links[at++] = from + src[i]!;
      links[at++] = to + dst[i]!;
    }
  });
  return links;
}

/** The property a vertex's text is read from: `title` where its type has it, else its identity. */
export const titleColumn = (type: VertexType, title: string | undefined): string | undefined =>
  title !== undefined && propertyOf(type, title) ? title : identityOf(type);

/** One vertex's properties, in its type's order. */
export interface VertexDetail {
  readonly vertex: number;
  /** The vertex type it belongs to. */
  readonly table: string;
  readonly fields: readonly { readonly name: string; readonly value: unknown }[];
}

/** One vertex's properties: `Graph.vertex`, by its type and its index within it. */
export async function readVertex(graph: Graph, vertex: number, signal?: AbortSignal): Promise<VertexDetail | null> {
  const at = tableOf(graph, vertex);
  if (!at) return null;
  const record = await graph.vertex(at.type.type, vertex - at.first, { signal });
  if (!record) return null;
  return { vertex, table: at.type.type, fields: at.type.properties.map(({ name }) => ({ name, value: record[name] ?? null })) };
}

/** The text of a few vertices, by id — a label's, a hover card's: each `Graph.vertex`, its title read. */
export async function readTitles(graph: Graph, vertices: readonly number[], title: string | undefined, signal?: AbortSignal): Promise<Map<number, string>> {
  const found = new Map<number, string>();
  await Promise.all(
    vertices.map(async (vertex) => {
      const at = tableOf(graph, vertex);
      const column = at && titleColumn(at.type, title);
      if (!at || column === undefined) return;
      const record = await graph.vertex(at.type.type, vertex - at.first, { signal });
      if (record) found.set(vertex, String(record[column] ?? ""));
    }),
  );
  return found;
}

/**
 * **A search, as typed** — Neo4j Bloom's prefixes over Cosmograph's search. `type:<Type>` keeps a
 * vertex type by name; `<property>:<value>` keeps the vertices whose property contains the value;
 * every other word is text some text property must contain. A word is a prefix only when what
 * precedes its colon is `type` or a property some vertex type has, so an IRI typed whole stays text.
 */
export interface VertexQuery {
  readonly text: string;
  /** Vertex types, by name; none is every type. */
  readonly types: readonly string[];
  /** Properties and what each must contain, every one of them. */
  readonly fields: readonly { readonly column: string; readonly value: string }[];
}

const same = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0;

/** `input` read as a {@link VertexQuery}. A prefix with nothing after its colon yet asks for nothing. */
export function parseQuery(input: string, graph: Graph): VertexQuery {
  const text: string[] = [];
  const types: string[] = [];
  const fields: { column: string; value: string }[] = [];
  for (const word of input.trim().split(/\s+/)) {
    const [, key = "", value = ""] = /^([^:]+):(.*)$/.exec(word) ?? [];
    if (same(key, "type")) {
      if (value !== "") types.push(value);
    } else if (key !== "" && graph.vertexTypes.some((type) => type.properties.some((p) => same(p.name, key)))) {
      if (value !== "") fields.push({ column: key, value });
    } else if (word !== "") {
      text.push(word);
    }
  }
  return { text: text.join(" "), types, fields };
}

/**
 * **The clause rule**: a type answers a clause when its rows have every column the clause names — a
 * semi-join on the key names that alone, so every type answers it.
 */
export function answers({ type }: Placed, clause: ExprNode): boolean {
  return clauseColumns(clause).every((c) => c === KEY || propertyOf(type, c) !== undefined);
}

/** The clauses of a predicate, as a list: a selection's `predicate` answers one, many or none. */
export function clausesOf(filter: FilterExpr | null | undefined): ExprNode[] {
  // What a selection publishes is a node per clause; a predicate is never a bare string or boolean here.
  return (Array.isArray(filter) ? filter : [filter]).filter((c) => c !== undefined && c !== null) as ExprNode[];
}

/**
 * What a search answered: the first matches, and how many it found, in all and per type. A match
 * carries the property that matched beside its text.
 */
export interface Found {
  readonly matches: readonly { readonly id: number; readonly text: string; readonly key: string; readonly type: string }[];
  readonly total: number;
  readonly byType: ReadonlyMap<string, number>;
  /** How many matches the subset leaves out: found, but not listed. */
  readonly outside: number;
}

/** The most matches one search reads from the graph before the prefixes and the subset narrow them. */
const READ = 1000;

/** Every vertex `query` finds — `Graph.search` of its text, narrowed by its prefixes — each once, as its first match. */
async function found(graph: Graph, query: VertexQuery, signal?: AbortSignal) {
  const text = query.text || query.fields[0]?.value || "";
  if (text === "") return [];
  const matches = await graph.search(text, { limit: READ, signal });
  const seen = new Set<number>();
  return matches.flatMap((m) => {
    const id = firstOf(graph, m.type) + m.index;
    const kept =
      (query.types.length === 0 || query.types.some((type) => same(type, m.type))) &&
      query.fields.every((f) => same(f.column, m.property) && m.value.toLowerCase().includes(f.value.toLowerCase())) &&
      !seen.has(id);
    if (!kept) return [];
    seen.add(id);
    return [{ id, text: m.value, key: m.property, type: m.type }];
  });
}

/** Which of `ids` the subset keeps: one statement over the types that answer every clause of it. */
async function inside(engine: Engine, graph: Graph, ids: readonly number[], subset: readonly ExprNode[], signal?: AbortSignal): Promise<Set<number>> {
  if (subset.length === 0 || ids.length === 0) return new Set(ids);
  const asked = placed(graph).filter((at) => subset.every((clause) => answers(at, clause)));
  if (asked.length === 0) return new Set();
  const union = Query.unionAll(asked.map((at) => Query.select({ id: float64(KEY) }).from(rowsOf(at)).where(and(isIn(KEY, ids.map((id) => literal(id))), ...subset))));
  const answer = await ask(engine, union, signal);
  return new Set(Array.from(answer.getChild("id")?.toArray() ?? [], Number));
}

/**
 * **The first `limit` vertices `query` finds inside `subset`**, shortest text first, with how many
 * there are of each type and how many the subset leaves out. Nothing is read until the reader types.
 */
export async function searchVertices(
  engine: Engine,
  graph: Graph,
  { query, limit, subset }: { query: VertexQuery; limit: number; subset: readonly ExprNode[] },
  signal?: AbortSignal,
): Promise<Found> {
  const all = await found(graph, query, signal);
  const kept = await inside(engine, graph, all.map((m) => m.id), subset, signal);
  const matches = all.filter((m) => kept.has(m.id)).sort((a, b) => a.text.length - b.text.length || a.text.localeCompare(b.text) || a.id - b.id);
  const byType = new Map<string, number>();
  for (const m of matches) byType.set(m.type, (byType.get(m.type) ?? 0) + 1);
  return { matches: matches.slice(0, limit), total: matches.length, byType, outside: all.length - matches.length };
}

/** Every vertex `query` finds inside `subset`, by id — what a search adds to the subset. */
export async function matchingIds(engine: Engine, graph: Graph, query: VertexQuery, subset: readonly ExprNode[], signal?: AbortSignal): Promise<number[]> {
  const all = await found(graph, query, signal);
  const kept = await inside(engine, graph, all.map((m) => m.id), subset, signal);
  return all.filter((m) => kept.has(m.id)).map((m) => m.id);
}
