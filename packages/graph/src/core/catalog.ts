import { Query, and, asc, cast, eq, float64, literal, sql, type Engine, type JoinColumnStats } from "@kanzo-tech/mosaic";
import { ask, relation, type Answer } from "./source";
import { DST, DST_INDEX, KEY, SRC, SRC_INDEX, VERTEX_INDEX, type Column, type EdgeTable, type Structure, type VertexTable } from "./structure";

/** The key of a chunk's Parquet footer that holds what its writer counted: `{ "<column>": { … } }`. */
const STATS_KEY = "fossil:stats";

/**
 * **The one read of a graph's catalog.** `@kanzo-tech/graphar-duckdb`'s `attachGraph` puts a view per
 * vertex and edge type in the catalog and the graph's information files beside them as relations —
 * `graphar_vertex_types`, `graphar_edge_types`, `graphar_properties` and `graphar_chunks`, in GraphAr's
 * words — and this is the only function in the library that reads them: the canvas's structure and
 * `JoinGraph` are both built from what it answers, so a change in how a graph states itself is a
 * change here and nowhere else. The DuckDB type of each column is the engine's own catalog's,
 * `duckdb_columns()`, read in the same breath: what the engine will read the view as, never a mapping
 * of GraphAr's words kept here.
 *
 * Every vertex type is a node type, and its primary key is its identity (the id itself where it has
 * none). The global id is this function's arithmetic: a type's `first` is the sum of the counts of the
 * types before it, in the graph document's order (`ordinal`).
 *
 * **What a column holds is read from the chunks' footers**, through the same engine: `graphar_chunks`
 * names each vertex chunk as the engine reads it, `parquet_kv_metadata` gives the writer's distinct
 * count and commonest values under `fossil:stats`, and `parquet_metadata` the nulls and the extent.
 * A column is counted when one chunk of its type states it — counts of a column cut across chunks do
 * not combine — and a list column is never counted.
 *
 * Four statements at once, then the footers in two more, each on the engine's own door with the
 * load's signal, so leaving a graph stops its catalog read. Nothing caches them: a join graph built
 * beside the canvas reads the catalog a second time, six small statements over footers DuckDB keeps.
 */
export async function readCatalog(engine: Engine, from: string, signal?: AbortSignal): Promise<Structure> {
  const [types, edgeTypes, properties, declared, chunks] = await Promise.all([
    ask(engine, Query.select("type", { count: cast("count", "DOUBLE") }).from(relation(from, "graphar_vertex_types")).orderby(asc("ordinal")), signal),
    ask(
      engine,
      Query.select("name", "src_type", "edge_type", "dst_type", { count: cast("count", "DOUBLE") })
        .from(relation(from, "graphar_edge_types"))
        .orderby(asc("ordinal")),
      signal,
    ),
    ask(
      engine,
      Query.select("type", "property", "is_primary", "is_nullable").from(relation(from, "graphar_properties")).orderby("type", "ordinal"),
      signal,
    ),
    ask(
      engine,
      Query.select("table_name", "column_name", { data_type: cast("data_type", "VARCHAR") })
        .from(sql`duckdb_columns()`)
        .where(and(eq("database_name", literal(from)), eq("schema_name", literal("main")))),
      signal,
    ),
    ask(engine, Query.select("type", "path").from(relation(from, "graphar_chunks")).where(eq("kind", literal("vertex"))), signal),
  ]);

  const at = (table: unknown, name: unknown) => `${String(table)}\u0000${String(name)}`;
  const engineTypes = new Map<string, string>();
  each(declared, (row) => engineTypes.set(at(row("table_name"), row("column_name")), String(row("data_type"))));
  const counted = await readCounts(engine, chunks, engineTypes, signal);

  const byType = new Map<string, Map<string, Column>>();
  each(properties, (row) => {
    const [type, name] = [String(row("type")), String(row("property"))];
    const columns = byType.get(type) ?? new Map<string, Column>();
    const sqlType = engineTypes.get(at(type, name)) ?? "";
    columns.set(name, {
      type: sqlType,
      primary: row("is_primary") === true,
      nullable: row("is_nullable") === true,
      stats: sqlType.endsWith("[]") ? null : (counted.get(at(type, name)) ?? null),
    });
    byType.set(type, columns);
  });

  const vertices: VertexTable[] = [];
  let size = 0;
  each(types, (row) => {
    const name = String(row("type"));
    const first = size;
    const rows = Number(row("count"));
    size += rows;
    const own = byType.get(name) ?? new Map<string, Column>();
    // The id's counts are the arithmetic's own: never null, never repeated, `first … first + rows − 1`.
    const id: Column = {
      type: "UINTEGER",
      primary: false,
      nullable: false,
      stats:
        rows === 0
          ? null
          : { nullCount: 0, distinctCount: rows, minValue: String(first), maxValue: String(first + rows - 1), mostCommonVals: [], mostCommonFreqs: [] },
    };
    const columns = new Map<string, Column>([[KEY, id], ...own]);
    const identity = [...own].find(([, c]) => c.primary)?.[0] ?? KEY;
    const properties = [...columns.keys()].filter((c) => c !== KEY);
    const table = Query.select({ [KEY]: global(first, VERTEX_INDEX) }, properties).from(relation(from, name));
    vertices.push({ name, first, rows, table, columns, identity });
  });

  const firstOf = new Map(vertices.map((v) => [v.name, v.first]));
  const edges: EdgeTable[] = [];
  each(edgeTypes, (row) => {
    const [name, source, destination] = [String(row("name")), String(row("src_type")), String(row("dst_type"))];
    const [src, dst] = [firstOf.get(source), firstOf.get(destination)];
    // An edge between types the graph does not declare draws nothing.
    if (src === undefined || dst === undefined) return;
    const table = Query.select({ [SRC]: global(src, SRC_INDEX), [DST]: global(dst, DST_INDEX) }).from(relation(from, name));
    edges.push({ name, label: String(row("edge_type")), source, destination, rows: Number(row("count")), table });
  });
  return { from, vertices, edges, size };
}

/**
 * A per-type index as a global id: `first + index`, as a `UINTEGER` — the writer refuses more than
 * 2³² vertices, so it fits, and it keeps the Arrow at four bytes an id where GraphAr's `int64` is eight.
 */
const global = (first: number, index: typeof VERTEX_INDEX | typeof SRC_INDEX | typeof DST_INDEX) =>
  // `index` is one of GraphAr's three reserved names, never text from a graph: quoted here as written.
  cast(sql`${first} + "${index}"`, "UINTEGER");

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
  engine: Engine,
  chunks: Answer,
  engineTypes: ReadonlyMap<string, string>,
  signal?: AbortSignal,
): Promise<Map<string, JoinColumnStats>> {
  const paths: { type: string; path: string }[] = [];
  each(chunks, (row) => paths.push({ type: String(row("type")), path: String(row("path")) }));
  const counted = new Map<string, JoinColumnStats>();
  if (paths.length === 0) return counted;
  const [stated, metadata] = await Promise.all([
    ask(
      engine,
      Query.unionAll(
        paths.map(({ path }) =>
          Query.select({ path: literal(path), stats: sql`decode(value)` })
            .from(sql`parquet_kv_metadata(${literal(path)})`)
            .where(eq(sql`decode(key)`, literal(STATS_KEY))),
        ),
      ),
      signal,
    ),
    ask(
      engine,
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
      signal,
    ),
  ]);

  // The footers' nulls and extent, per chunk and column. A bound a row group does not state, or states
  // cut short, is none; nulls a row group does not state leave the column uncounted.
  const footers = new Map<string, Footer | null>();
  each(metadata, (row) => {
    const key = `${String(row("path"))}\u0000${String(row("column"))}`;
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
    if (typeof document !== "object" || document === null) return;
    for (const [column, stats] of Object.entries(document)) {
      const key = `${type}\u0000${column}`;
      owners.set(key, [...(owners.get(key) ?? []), { path, stats: stats as Record<string, unknown> }]);
    }
  });
  for (const [key, [only, ...more]] of owners) {
    if (!only || more.length > 0) continue;
    const footer = footers.get(`${only.path}\u0000${key.split("\u0000")[1]}`);
    const { distinct_count: distinct, most_common_vals: vals, most_common_freqs: freqs } = only.stats;
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
function each(answer: Answer, visit: (row: (name: string) => unknown) => void): void {
  const cache = new Map<string, ArrayLike<unknown>>();
  const values = (name: string) => {
    let found = cache.get(name);
    if (!found) cache.set(name, (found = answer.getChild(name)?.toArray() ?? []));
    return found;
  };
  for (let i = 0; i < answer.numRows; i++) visit((name) => values(name)[i]);
}
