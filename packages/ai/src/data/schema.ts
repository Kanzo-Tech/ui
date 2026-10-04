import { asTableRef, eq, literal, Query, type Coordinator } from "@kanzo-tech/mosaic";

/**
 * A join the catalog does not carry: `table.column` holds `references.table`'s `references.column`.
 * Views declare no foreign keys, so a host that knows a join exists says so here.
 */
export interface SchemaReference {
  table: string;
  column: string;
  references: { table: string; column: string };
}

/**
 * A data space as the agent knows it: the DDL the model reads, and the tables that DDL declares — the
 * ones a statement may read. One answer, so the tables the model is shown and the tables the gate lets
 * it read cannot be two lists.
 */
export interface DataSchema {
  /** The catalog as DuckDB DDL, every table qualified as a query must name it. */
  readonly ddl: string;
  /** Each table's path, as the DDL names it: `[catalog, table]`, or `[catalog, schema, table]`. */
  readonly tables: readonly (readonly string[])[];
}

export interface DescribeSchemaOptions {
  /** The catalog to describe — an attached database's name. */
  catalog: string;
  /** Tables of the catalog that are bookkeeping rather than data. */
  exclude?: readonly string[];
  /** The joins the catalog does not declare. Tables are named as in `catalog`. */
  references?: readonly SchemaReference[];
  signal?: AbortSignal;
}

interface ColumnRow {
  table_schema: string;
  table_name: string;
  column_name: string;
  data_type: string;
}

/**
 * A catalog as DuckDB DDL and the tables it declares, read back from DuckDB's own `information_schema` — what `dataAgent` is
 * given as its schema.
 *
 * Read from the engine rather than re-derived from a manifest, so the table names, the column names
 * and the column TYPES are the ones a query will actually meet. Every table is named as a query must
 * write it, qualified by its catalog. A reference is written as DDL writes one, `REFERENCES` on the
 * column, which is the form a model has read the most of.
 */
export async function describeSchema(coordinator: Coordinator, options: DescribeSchemaOptions): Promise<DataSchema> {
  const { catalog, exclude = [], references = [], signal } = options;
  const answer = (await coordinator.query(
    Query.from(asTableRef(["information_schema", "columns"])!)
      .select("table_schema", "table_name", "column_name", "data_type")
      .where(eq("table_catalog", literal(catalog)))
      .orderby("table_schema", "table_name", "ordinal_position"),
    { signal },
  )) as { toArray(): Iterable<ColumnRow> };

  const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;
  const path = (schema: string, table: string) => (schema === "main" ? [catalog, table] : [catalog, schema, table]);
  const name = (schema: string, table: string) => String(asTableRef(path(schema, table)));
  const joins = new Map(references.map((r) => [`${r.table}\u0000${r.column}`, r.references]));
  const hidden = new Set(exclude);
  const tables = new Map<string, { path: string[]; columns: string[] }>();
  for (const row of answer.toArray()) {
    if (hidden.has(row.table_name)) continue;
    const key = name(row.table_schema, row.table_name);
    const target = joins.get(`${row.table_name}\u0000${row.column_name}`);
    const column = `  ${quote(row.column_name)} ${row.data_type}${target ? ` REFERENCES ${name("main", target.table)} (${quote(target.column)})` : ""}`;
    const table = tables.get(key) ?? { path: path(row.table_schema, row.table_name), columns: [] };
    tables.set(key, { ...table, columns: [...table.columns, column] });
  }
  return {
    ddl: [...tables].map(([table, { columns }]) => `CREATE TABLE ${table} (\n${columns.join(",\n")}\n);`).join("\n\n"),
    tables: [...tables.values()].map((table) => table.path),
  };
}
