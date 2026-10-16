import type { Queryable, Table } from "@kanzo-tech/kernel";
import { Query, and, asTableRef, asc, cast, eq, float64, literal, sql, type ExprNode } from "@kanzo-tech/mosaic";
import { checked, type JoinColumn, type JoinColumnStats, type JoinGraph, type JoinType } from "./relation.js";

/**
 * **The one way to make a `JoinGraph` from an engine**: a catalog of some kind, attached to the engine
 * under `from`, read with the statements the reader writes and nothing else (`/docs/design/relations`).
 * A catalog of another kind is a second reader of this type, and nothing else changes.
 */
export type CatalogReader = (engine: Queryable, from: string, options: { readonly signal: AbortSignal }) => Promise<JoinGraph>;

/** The global id every vertex type is keyed by, and the graph's own arithmetic over GraphAr's per-type index. */
const KEY = "dense_id";
/** GraphAr's reserved columns (C++ `GeneralParams`), as `attachGraph`'s views carry them. */
const VERTEX_INDEX = "_graphArVertexIndex";
const SRC_INDEX = "_graphArSrcIndex";
const DST_INDEX = "_graphArDstIndex";
/** The columns an edge type's `table` holds its ends in, as global ids. */
const SRC = "src";
const DST = "dst";
/** The union of every vertex type, which a canvas reads and publishes on. */
const VERTICES = "vertices";
/** The key of a chunk's Parquet footer that holds what its writer counted: `{ "version": 1, "columns": { "<column>": { … } } }`. */
const STATS_KEY = "fossil:stats";

/** A relation of the attached graph: `"<from>"."<table>"`. `asTableRef` answers `undefined` only for no input. */
const relation = (from: string, table: string): ExprNode => asTableRef([from, table])!;

/**
 * **The reader of an attached GraphAr graph.** `@kanzo-tech/graphar-duckdb`'s `attachGraph` puts a view
 * per vertex and edge type in the catalog `from` and the graph's information files beside them as
 * relations — `graphar_vertex_types`, `graphar_edge_types`, `graphar_properties` and `graphar_chunks`,
 * in GraphAr's words — and this is the only function in the library that reads them. The DuckDB type
 * of each column is the engine's own catalog's, `duckdb_columns()`, read in the same breath: what the
 * engine will read the view as, never a mapping of GraphAr's words kept here.
 *
 * Every vertex type is a type keyed by the global id, `dense_id`, its `table` the type's view under
 * that id; its primary key is its identity (the id itself where it has none). GraphAr numbers vertices
 * per type from zero; a type's ids start at the sum of the counts of the types before it, in the graph
 * document's order (`ordinal`), so one id space serves every hop and the semi-join across types. An
 * edge type joins through `src` and `dst`, global ids too. Each carries the count the catalog holds,
 * and each vertex type its `first`. What it answers is `checked`: a contradiction is refused
 * (`relations/invalid`) here, where the graph is made.
 *
 * And one more type, `vertices`: every vertex type as one relation, `NULL` where a type has no such
 * column, so a clause on any type crosses into it by key and one on it into each type.
 *
 * **What a column holds is read from the chunks' footers**: `graphar_chunks` names each vertex chunk as
 * the engine reads it, `parquet_kv_metadata` gives the writer's distinct count and commonest values
 * under `fossil:stats`, and `parquet_metadata` the nulls and the extent. A column is counted when one
 * chunk of its type states it — counts of a column cut across chunks do not combine — and a list
 * column is never counted. Five statements at once, then the footers in two more, each carrying the
 * caller's signal.
 */
export const readJoinGraph: CatalogReader = async (engine, from, { signal }) => {
  const ask = (query: Query) => engine.query(String(query), { signal });
  const [types, edgeTypes, properties, columnTypes, chunks] = await Promise.all([
    ask(Query.select("type", { count: cast("count", "DOUBLE") }).from(relation(from, "graphar_vertex_types")).orderby(asc("ordinal"))),
    ask(
      Query.select("name", "src_type", "edge_type", "dst_type", { count: cast("count", "DOUBLE") })
        .from(relation(from, "graphar_edge_types"))
        .orderby(asc("ordinal")),
    ),
    ask(Query.select("type", "property", "is_primary", "is_nullable").from(relation(from, "graphar_properties")).orderby("type", "ordinal")),
    ask(
      Query.select("table_name", "column_name", { data_type: cast("data_type", "VARCHAR") })
        .from(sql`duckdb_columns()`)
        .where(and(eq("database_name", literal(from)), eq("schema_name", literal("main")))),
    ),
    ask(Query.select("type", "path").from(relation(from, "graphar_chunks")).where(eq("kind", literal("vertex")))),
  ]);

  const engineTypes = new Map<string, string>();
  each(columnTypes, (row) => engineTypes.set(at(row("table_name"), row("column_name")), String(row("data_type"))));
  const counted = await readCounts(engine, chunks, engineTypes, signal);

  const byType = new Map<string, JoinColumn[]>();
  each(properties, (row) => {
    const [type, name] = [String(row("type")), String(row("property"))];
    const type_ = engineTypes.get(at(type, name)) ?? "";
    const stats = type_.endsWith("[]") ? undefined : counted.get(at(type, name));
    const column: JoinColumn = {
      name,
      type: type_,
      ...(row("is_primary") === true ? { role: "identity" } : {}),
      nullable: row("is_nullable") === true,
      ...(stats ? { stats } : {}),
    };
    byType.set(type, [...(byType.get(type) ?? []), column]);
  });

  const vertices: JoinType[] = [];
  const firstOf = new Map<string, number>();
  let size = 0;
  each(types, (row) => {
    const name = String(row("type"));
    const first = size;
    const rows = Number(row("count"));
    size += rows;
    firstOf.set(name, first);
    const own = byType.get(name) ?? [];
    // The id's counts are the arithmetic's own: never null, never repeated, `first … first + rows − 1`.
    const id: JoinColumn = {
      name: KEY,
      type: "UINTEGER",
      role: "address",
      nullable: false,
      ...(rows === 0
        ? {}
        : { stats: { nullCount: 0, distinctCount: rows, minValue: String(first), maxValue: String(first + rows - 1), mostCommonVals: [], mostCommonFreqs: [] } }),
    };
    const identity = own.find((c) => c.role === "identity")?.name ?? KEY;
    vertices.push({
      name,
      table: Query.select({ [KEY]: global(first, VERTEX_INDEX) }, own.map((c) => c.name)).from(relation(from, name)),
      key: KEY,
      columns: [id, ...own],
      rows,
      first,
      // The global id and the primary key: each never null and never repeated.
      candidateKeys: [...new Set([KEY, identity])],
    });
  });

  const edges = [] as JoinGraph["edges"][number][];
  each(edgeTypes, (row) => {
    const [name, source, destination] = [String(row("name")), String(row("src_type")), String(row("dst_type"))];
    const [src, dst] = [firstOf.get(source), firstOf.get(destination)];
    // An edge between types the graph does not declare joins nothing.
    if (src === undefined || dst === undefined) return;
    const table = Query.select({ [SRC]: global(src, SRC_INDEX), [DST]: global(dst, DST_INDEX) }).from(relation(from, name));
    edges.push({ name, label: String(row("edge_type")), source, destination, table, src: SRC, dst: DST, rows: Number(row("count")) });
  });

  return checked({ types: [...vertices, union(vertices, size)], edges });
};

/**
 * **Every vertex as one relation** — each vertex type's rows under the global id, with every column
 * some type has: `NULL` in a type without it, so a clause on a column keeps none of a type that has no
 * such column (`/docs/design/crossfilter`). A column two types declare with different types is not one
 * column, and is left out. Its columns are described as their first type describes them, without
 * counts: those were taken per type.
 */
function union(vertices: readonly JoinType[], size: number): JoinType {
  const types = new Map<string, string | null>();
  for (const vertex of vertices) {
    for (const { name, type } of vertex.columns) {
      if (name === KEY) continue;
      const seen = types.get(name);
      types.set(name, seen === undefined || seen === type ? type : null);
    }
  }
  const names = [...types].flatMap(([name, type]) => (type === null ? [] : [name]));
  const has = (vertex: JoinType, name: string) => vertex.columns.some((c) => c.name === name);
  const table = Query.unionAll(
    vertices.map((v) => Query.select({ [KEY]: KEY, ...Object.fromEntries(names.map((c) => [c, has(v, c) ? c : literal(null)])) }).from(v.table)),
  );
  // The key is the id's, a graph with no vertex type's too; every other column is described as the
  // catalog states it, never with what was counted of it in one type.
  const id: JoinColumn = { name: KEY, type: "UINTEGER", role: "address", nullable: false };
  const columns = [id, ...names.flatMap((name) => {
    const found = vertices.find((v) => has(v, name))?.columns.find((c) => c.name === name);
    return found ? [Object.fromEntries(Object.entries(found).filter(([fact]) => fact !== "stats")) as unknown as JoinColumn] : [];
  })];
  return { name: VERTICES, table, key: KEY, columns, rows: size, of: vertices.map((v) => v.name) };
}

/**
 * A per-type index as a global id: `first + index`, as a `UINTEGER` — the writer refuses more than
 * 2³² vertices, so it fits, and it keeps the Arrow at four bytes an id where GraphAr's `int64` is eight.
 */
const global = (first: number, index: typeof VERTEX_INDEX | typeof SRC_INDEX | typeof DST_INDEX) =>
  // `index` is one of GraphAr's three reserved names, never text from a graph: quoted here as written.
  cast(sql`${first} + "${index}"`, "UINTEGER");

const at = (table: unknown, name: unknown) => `${String(table)}\u0000${String(name)}`;

/** One footer fact per chunk and column, folded as the chunk's row groups state it. */
interface Footer {
  nulls: number;
  min: string | null;
  max: string | null;
}

/**
 * The writer's counts, by `<type>\0<column>`: what `fossil:stats` says of a column that one chunk of
 * its type states, and the nulls and extent of the chunk's row groups. A type or a column with no
 * such statement is absent — a graph a foreign writer made states none.
 */
async function readCounts(
  engine: Queryable,
  chunks: Table,
  engineTypes: ReadonlyMap<string, string>,
  signal: AbortSignal,
): Promise<Map<string, JoinColumnStats>> {
  const paths: { type: string; path: string }[] = [];
  each(chunks, (row) => paths.push({ type: String(row("type")), path: String(row("path")) }));
  const counted = new Map<string, JoinColumnStats>();
  if (paths.length === 0) return counted;
  const ask = (query: Query) => engine.query(String(query), { signal });
  const [stated, metadata] = await Promise.all([
    ask(
      Query.unionAll(
        paths.map(({ path }) =>
          Query.select({ path: literal(path), stats: sql`decode(value)` })
            .from(sql`parquet_kv_metadata(${literal(path)})`)
            .where(eq(sql`decode(key)`, literal(STATS_KEY))),
        ),
      ),
    ),
    ask(
      Query.unionAll(
        paths.map(({ path }) =>
          Query.select({
            path: literal(path),
            column: "path_in_schema",
            nulls: float64("stats_null_count"),
            min: "stats_min_value",
            max: "stats_max_value",
            exact: sql`min_is_exact AND max_is_exact`,
          }).from(sql`parquet_metadata(${literal(path)})`),
        ),
      ),
    ),
  ]);

  // The footers' nulls and extent, per chunk and column. A bound a row group does not state, or states
  // cut short, is none; nulls a row group does not state leave the column uncounted.
  const footers = new Map<string, Footer | null>();
  each(metadata, (row) => {
    const key = at(row("path"), row("column"));
    const [nulls, min, max] = [row("nulls"), row("min"), row("max")];
    const seen = footers.get(key);
    if (seen === null) return;
    if (nulls === null || nulls === undefined) return void footers.set(key, null);
    const exact = row("exact") === true && min !== null && min !== undefined && max !== null && max !== undefined;
    footers.set(key, {
      nulls: (seen?.nulls ?? 0) + Number(nulls),
      min: !exact || (seen && seen.min === null) ? null : pick(seen?.min ?? null, String(min), -1),
      max: !exact || (seen && seen.max === null) ? null : pick(seen?.max ?? null, String(max), 1),
    });
  });

  // A column stated by exactly one chunk of its type is the column's: the counts do not combine.
  const owners = new Map<string, { path: string; stats: Record<string, unknown> }[]>();
  const typeOf = new Map(paths.map(({ path, type }) => [path, type]));
  each(stated, (row) => {
    const [path, type] = [String(row("path")), typeOf.get(String(row("path")))];
    if (type === undefined) return;
    let document: unknown;
    try {
      document = JSON.parse(String(row("stats")));
    } catch {
      // A footer that does not read states nothing.
      return;
    }
    // fossil's document is versioned, and a reader of the key refuses a version it does not know
    // (fossil's `/docs/format/conventions/statistics`): `{ "version": 1, "columns": { "<column>": … } }`.
    const { version, columns } = (document ?? {}) as { version?: unknown; columns?: unknown };
    if (version !== 1 || typeof columns !== "object" || columns === null) return;
    for (const [column, stats] of Object.entries(columns)) {
      const key = at(type, column);
      owners.set(key, [...(owners.get(key) ?? []), { path, stats: stats as Record<string, unknown> }]);
    }
  });
  for (const [key, [only, ...more]] of owners) {
    if (!only || more.length > 0) continue;
    const footer = footers.get(at(only.path, key.split("\u0000")[1]));
    // The commonest values are absent when no value repeats: a key has none.
    const { distinct_count: distinct, most_common_vals: vals = [], most_common_freqs: freqs = [] } = only.stats;
    if (!footer || typeof distinct !== "number" || !Array.isArray(vals) || !Array.isArray(freqs)) continue;
    // A bound is kept for a number or a time; a text's is never read.
    const type = engineTypes.get(key) ?? "";
    const extent = (numeric(type) || temporal(type)) && footer.min !== null && footer.max !== null;
    counted.set(key, {
      nullCount: footer.nulls,
      distinctCount: distinct,
      ...(extent ? { minValue: footer.min as string, maxValue: footer.max as string } : {}),
      mostCommonVals: vals.map(String),
      mostCommonFreqs: freqs.map(Number),
    });
  }
  return counted;
}

const numeric = (type: string) => /^(U?(TINY|SMALL|BIG|HUGE)?INT(EGER)?|FLOAT|DOUBLE|DECIMAL.*)$/.test(type);
const temporal = (type: string) => /^(DATE|TIMESTAMP.*)$/.test(type);

/** The smaller (`-1`) or larger (`1`) of two bounds read as text: by value when both are numbers, else by text — ISO dates sort as written. */
function pick(a: string | null, b: string, side: -1 | 1): string {
  if (a === null) return b;
  const [x, y] = [Number(a), Number(b)];
  const order = Number.isNaN(x) || Number.isNaN(y) ? (a < b ? -1 : a > b ? 1 : 0) : Math.sign(x - y);
  return order === side ? a : order === 0 ? a : b;
}

/** Each row of an answer, read by column name. */
function each(answer: Table, visit: (row: (name: string) => unknown) => void): void {
  const cache = new Map<string, ArrayLike<unknown>>();
  const values = (name: string) => {
    let found = cache.get(name);
    if (!found) cache.set(name, (found = answer.getChild(name)?.toArray() ?? []));
    return found;
  };
  for (let i = 0; i < answer.numRows; i++) visit((name) => values(name)[i]);
}
