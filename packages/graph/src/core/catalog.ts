import { Query, and, asc, cast, eq, literal, sql, type Coordinator } from "@kanzo-tech/mosaic";
import { ask, relation, type Answer } from "./source";
import { DST, DST_INDEX, KEY, SRC, SRC_INDEX, VERTEX_INDEX, type Column, type EdgeTable, type Structure, type VertexTable } from "./structure";

/**
 * **The one read of a graph's catalog.** `@kanzo-tech/graphar-duckdb`'s `attachGraph` puts a view per
 * vertex and edge type in the catalog and the graph's information files beside them as relations —
 * `graphar_vertex_types`, `graphar_edge_types` and `graphar_properties`, in GraphAr's words — and this
 * is the only function in the library that reads them: the canvas's structure and `JoinGraph` are
 * both built from what it answers, so a change in how a graph states itself is a change here and
 * nowhere else. The DuckDB type of each column is the engine's own catalog's, `duckdb_columns()`,
 * read in the same breath: what the engine will read the view as, never a mapping of GraphAr's words
 * kept here.
 *
 * **A type with a primary key is a node type**; one without is a property table — a multi-valued
 * property, a row per value — and is neither drawn nor joined, because only the graph's mapping says
 * whose rows it holds. The global id is this function's arithmetic: a node type's `first` is the sum
 * of the counts of the node types before it, in the graph document's order (`ordinal`).
 *
 * Four statements, each through the page's coordinator and its cache, so the canvas and a join graph
 * built on one page read the catalog once.
 */
export async function readCatalog(coordinator: Coordinator, from: string): Promise<Structure> {
  const [types, edgeTypes, properties, engine] = await Promise.all([
    ask(coordinator, Query.select("type", { count: cast("count", "DOUBLE") }).from(relation(from, "graphar_vertex_types")).orderby(asc("ordinal"))),
    ask(
      coordinator,
      Query.select("name", "src_type", "edge_type", "dst_type", { count: cast("count", "DOUBLE") })
        .from(relation(from, "graphar_edge_types"))
        .orderby(asc("ordinal")),
    ),
    ask(
      coordinator,
      Query.select("type", "property", "is_primary", "is_nullable").from(relation(from, "graphar_properties")).orderby("type", "ordinal"),
    ),
    ask(
      coordinator,
      Query.select("table_name", "column_name", { data_type: cast("data_type", "VARCHAR") })
        .from(sql`duckdb_columns()`)
        .where(and(eq("database_name", literal(from)), eq("schema_name", literal("main")))),
    ),
  ]);

  const at = (table: unknown, name: unknown) => `${String(table)}\u0000${String(name)}`;
  const engineTypes = new Map<string, string>();
  each(engine, (row) => engineTypes.set(at(row("table_name"), row("column_name")), String(row("data_type"))));

  const byType = new Map<string, Map<string, Column>>();
  each(properties, (row) => {
    const [type, name] = [String(row("type")), String(row("property"))];
    const columns = byType.get(type) ?? new Map<string, Column>([[KEY, { type: "UINTEGER", primary: false, nullable: false }]]);
    columns.set(name, { type: engineTypes.get(at(type, name)) ?? "", primary: row("is_primary") === true, nullable: row("is_nullable") === true });
    byType.set(type, columns);
  });

  const vertices: VertexTable[] = [];
  let size = 0;
  each(types, (row) => {
    const name = String(row("type"));
    const columns = byType.get(name);
    const identity = columns && [...columns].find(([, c]) => c.primary)?.[0];
    if (!columns || identity === undefined) return;
    const first = size;
    const rows = Number(row("count"));
    size += rows;
    const properties = [...columns.keys()].filter((c) => c !== KEY);
    const table = Query.select({ [KEY]: global(first, VERTEX_INDEX) }, properties).from(relation(from, name));
    vertices.push({ name, first, rows, table, columns, identity });
  });

  const firstOf = new Map(vertices.map((v) => [v.name, v.first]));
  const edges: EdgeTable[] = [];
  each(edgeTypes, (row) => {
    const [name, source, destination] = [String(row("name")), String(row("src_type")), String(row("dst_type"))];
    const [src, dst] = [firstOf.get(source), firstOf.get(destination)];
    // An edge into a property table joins nothing a reader draws.
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
