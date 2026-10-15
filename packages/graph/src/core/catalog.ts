import { Query, and, asc, cast, eq, float64, literal, sql, type Coordinator, type JoinAnnotation, type JoinColumnStats } from "@kanzo-tech/mosaic";
import { Problem } from "@kanzo-tech/kernel";
import { ask, relation, type Answer } from "./source";
import type { Column, EdgeTable, PropertyTable, Structure, VertexTable } from "./structure";

/**
 * **The one read of a corpus's catalog.** fossil's `attach` puts the manifest beside the tables as
 * relations — `fossil_tables`, `fossil_columns`, `fossil_annotations` and `fossil_stats`
 * (`/docs/format` on fossil's site) — and this is the only function in the library that reads them:
 * the canvas's structure and `JoinGraph` are both built from what it answers, so a change in how a
 * corpus states itself is a change here and nowhere else. The DuckDB type of each column is the
 * engine's own catalog's, `duckdb_columns()`, read in the same breath: what the engine will read the
 * view as, never a mapping of fossil's spelling kept here.
 *
 * Five statements, each through the page's coordinator and its cache, so the canvas and a join graph
 * built on one page read the catalog once.
 */
export async function readCatalog(coordinator: Coordinator, from: string): Promise<Structure> {
  const [tables, columns, stats, annotations, engine] = await Promise.all([
    ask(
      coordinator,
      Query.select("table_name", "kind", "label", "iri", "source", "source_key", "destination", "destination_key", "candidate_keys", {
        record_count: float64("record_count"),
        first_id: float64("first_id"),
      })
        .from(relation(from, "fossil_tables"))
        .orderby(asc("first_id", false), "table_name"),
    ),
    ask(
      coordinator,
      Query.select("table_name", "column_name", "role", "iri", "term_type", "datatype", "is_nullable", {
        data_type: cast("data_type", "VARCHAR"),
      })
        .from(relation(from, "fossil_columns"))
        .orderby("table_name", "ordinal_position"),
    ),
    ask(
      coordinator,
      Query.select("table_name", "column_name", "min_value", "max_value", "most_common_vals", "most_common_freqs", {
        null_count: float64("null_count"),
        distinct_count: float64("distinct_count"),
      }).from(relation(from, "fossil_stats")),
    ),
    ask(
      coordinator,
      Query.select("table_name", "column_name", "predicate", "o_type", "o_value", "o_datatype", "o_lang").from(relation(from, "fossil_annotations")),
    ),
    ask(
      coordinator,
      Query.select("table_name", "column_name", { data_type: cast("data_type", "VARCHAR") })
        .from(sql`duckdb_columns()`)
        .where(and(eq("database_name", literal(from)), eq("schema_name", literal("main")))),
    ),
  ]);

  const at = (table: unknown, column: unknown) => `${String(table)}\u0000${column === null || column === undefined ? "" : String(column)}`;

  const notes = new Map<string, JoinAnnotation[]>();
  each(annotations, (row) => {
    const value = String(row("o_value"));
    const [datatype, language] = [text(row("o_datatype")), text(row("o_lang"))];
    const object: JoinAnnotation["object"] =
      row("o_type") === "I" ? value : { value, ...(language ? { language } : datatype ? { datatype } : {}) };
    const key = at(row("table_name"), row("column_name"));
    notes.set(key, [...(notes.get(key) ?? []), { predicate: String(row("predicate")), object }]);
  });

  const counted = new Map<string, JoinColumnStats>();
  each(stats, (row) => {
    // A corpus written before the writer counted has a row of nulls per column: no counts.
    if (row("distinct_count") === null || row("distinct_count") === undefined) return;
    counted.set(at(row("table_name"), row("column_name")), {
      nullCount: Number(row("null_count")),
      distinctCount: Number(row("distinct_count")),
      ...optional("minValue", text(row("min_value"))),
      ...optional("maxValue", text(row("max_value"))),
      mostCommonVals: list(row("most_common_vals")).map(String),
      mostCommonFreqs: list(row("most_common_freqs")).map(Number),
    });
  });

  const engineTypes = new Map<string, string>();
  each(engine, (row) => engineTypes.set(at(row("table_name"), row("column_name")), String(row("data_type"))));

  const byTable = new Map<string, Map<string, Column>>();
  let key: string | undefined;
  each(columns, (row) => {
    const [table, name] = [String(row("table_name")), String(row("column_name"))];
    const role = text(row("role"));
    const described = byTable.get(table) ?? new Map<string, Column>();
    described.set(name, {
      type: String(row("data_type") ?? ""),
      sqlType: engineTypes.get(at(table, name)) ?? "",
      role,
      datatype: text(row("datatype")),
      termType: text(row("term_type")),
      iri: text(row("iri")),
      nullable: row("is_nullable") === true,
      annotations: notes.get(at(table, name)) ?? [],
      stats: counted.get(at(table, name)) ?? null,
    });
    if (role === "address") key ??= name;
    byTable.set(table, described);
  });

  const vertices: VertexTable[] = [];
  const edges: EdgeTable[] = [];
  const properties: PropertyTable[] = [];
  // Each kind by name; a kind this reader does not know is none of the three.
  each(tables, (row) => {
    const name = String(row("table_name"));
    const described = byTable.get(name) ?? new Map<string, Column>();
    const shared = { rows: Number(row("record_count")), annotations: notes.get(at(name, null)) ?? [] };
    const candidateKeys = list(row("candidate_keys")).map(String);
    if (row("kind") === "vertex") {
      const identity = [...described].find(([, c]) => c.role === "identity")?.[0] ?? "subject";
      vertices.push({ name, first: Number(row("first_id")), columns: described, identity, candidateKeys, iri: text(row("iri")), ...shared });
    } else if (row("kind") === "edge") {
      edges.push({
        name,
        label: String(row("label")),
        source: String(row("source")),
        destination: String(row("destination")),
        sourceKey: String(row("source_key")),
        destinationKey: String(row("destination_key")),
        iri: text(row("iri")),
        ...shared,
      });
    } else if (row("kind") === "property") {
      const { rows } = shared;
      properties.push({ name, label: String(row("label")), source: String(row("source")), sourceKey: String(row("source_key")), rows, columns: described, candidateKeys });
    }
  });
  if (key === undefined && vertices.length > 0) {
    throw new Problem("graph/nothing-to-draw", `the corpus attached as ${from} gives no column the address role`);
  }
  return { from, key: key ?? "", vertices, edges, properties, size: vertices.reduce((sum, v) => sum + v.rows, 0) };
}

/** Each row of an answer, read by column name. */
function each(answer: Answer, visit: (row: (name: string) => unknown) => void): void {
  const cache = new Map<string, ArrayLike<unknown>>();
  const column = (name: string) => {
    let values = cache.get(name);
    if (!values) cache.set(name, (values = answer.getChild(name)?.toArray() ?? []));
    return values;
  };
  for (let i = 0; i < answer.numRows; i++) visit((name) => column(name)[i]);
}

/** A text cell, or `null` for none — an empty string is none too, as `fossil_annotations` spells a missing tag. */
const text = (value: unknown): string | null => (value === null || value === undefined || value === "" ? null : String(value));

/** A list cell as an array: Arrow hands one back as a vector, which iterates. */
const list = (value: unknown): unknown[] =>
  value === null || value === undefined ? [] : Array.from(value as Iterable<unknown>);

const optional = <K extends string>(name: K, value: string | null) => (value === null ? {} : ({ [name]: value } as Record<K, string>));
