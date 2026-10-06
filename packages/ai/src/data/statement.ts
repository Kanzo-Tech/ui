import { literal, Query, sql, type Coordinator, type Selection, type TableExpr } from "@kanzo-tech/mosaic";
import type { DataSchema } from "./schema.js";

/**
 * What the reader is looking at: the page's crossfilter, and the relation its clauses filter. A
 * statement may read it as a table named `scope` — the relation's rows under the clauses active when
 * the statement runs.
 */
export interface DataScope {
  selection: Selection;
  table: TableExpr;
}

/** The scope's own statement: the relation under the clauses active now. */
export const scoped = (scope: DataScope) =>
  Query.from(scope.table)
    .select("*")
    .where(scope.selection.predicate(null) ?? []);

export interface StatementGateOptions {
  /** The tables a statement may read: `DataSchema.tables`, the ones the model was shown. */
  tables: DataSchema["tables"];
  /** Offered to the statement as `scope`, the one table it may read beside `tables`. */
  scope?: DataScope;
  /** The most rows the statement brings back. */
  limit: number;
}

/** Why a statement may not run, in words the model can act on. */
export interface StatementRefusal {
  readonly message: string;
  readonly code: "query/refused";
}

/** The statement that may run, or why the model's may not. */
export type GatedStatement = { readonly statement: string } | { readonly refused: StatementRefusal };

/**
 * The one door from a model's SQL to the page's engine: one read-only SELECT over the tables the model
 * was shown, or a refusal.
 *
 * The engine it guards is the page's one connection, with `httpfs` and `json` loaded and a scoped
 * secret beside it — a statement that reached it unread could drop a view the page draws, copy a table to a bucket,
 * or read any URL. So the text is never run, and never spliced into anything that runs: DuckDB's own
 * parser reads it (`json_serialize_sql`, the text going in as a literal), the gate reads the parse,
 * and DuckDB prints the parse back (`json_deserialize_sql`). What runs is that print, wrapped in the
 * cap and the scope by mosaic-sql — DuckDB's rendering of one SELECT, not the model's text.
 *
 * It refuses:
 * - anything but exactly one SELECT — `json_serialize_sql` serialises nothing else, so DDL, `COPY`,
 *   `ATTACH`, `SET`, `PRAGMA` and a second statement are refused by the parser before the gate looks;
 * - a relation that is not a table, a subquery, a join, `VALUES` or a pivot — a table function
 *   (`read_csv`, `read_text`, `glob`, `query_table`, `duckdb_secrets()`, `pragma_*`) and a `DESCRIBE`,
 *   `SHOW` or `SUMMARIZE` among them;
 * - a table that is neither one of `tables`, nor `scope`, nor a CTE the statement defines where it is
 *   read — a file or URL named as a table is a table nobody described;
 * - a CTE named `scope`: the reader's selection is read, never redefined.
 *
 * A refusal is an answer, not a throw: the model reads it and writes another statement.
 *
 * What it cannot prove: what a scalar function does. It reads where rows come from, not what is
 * computed over them, so `current_setting(…)` or `getvariable(…)` pass; neither reads a file, a URL
 * or a table.
 */
export async function gateStatement(
  coordinator: Coordinator,
  text: string,
  options: StatementGateOptions,
): Promise<GatedStatement> {
  const { tables, scope, limit } = options;
  const ast = await answer(coordinator, "ast", sql`json_serialize_sql(${literal(text)})`);
  const parsed = JSON.parse(ast) as Parse;
  if (parsed.error) return refuse(parsed.error_type === "not implemented" ? "Only a SELECT may run." : parsed.error_message);
  if (parsed.statements.length !== 1) return refuse(`That is ${parsed.statements.length} statements; one SELECT may run.`);

  const readable = new Set(tables.map(key));
  if (scope) readable.add(key(["scope"]));
  const why = refusal(parsed.statements[0]!, { readable, names: tables, scope: !!scope }, new Set());
  if (why) return refuse(why);

  const printed = await answer(coordinator, "text", sql`json_deserialize_sql(${literal(ast)})`);
  const query = Query.from(sql`(${printed})`).select("*").limit(limit);
  return { statement: String(scope ? query.with({ scope: scoped(scope) }) : query) };
}

/** `json_serialize_sql`'s answer: the parse, or the parser's refusal. */
type Parse = { error: false; statements: Json[] } | { error: true; error_type: string; error_message: string };
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const refuse = (message: string): GatedStatement => ({ refused: { message, code: "query/refused" } });

/** One value, asked of the engine — the text it is asked about is a literal, never a statement. */
async function answer(coordinator: Coordinator, name: string, expression: ReturnType<typeof sql>): Promise<string> {
  const table = (await coordinator.query(Query.select({ [name]: expression }))) as { toArray(): Record<string, unknown>[] };
  return String(table.toArray()[0]?.[name]);
}

/** A table's path compared as DuckDB compares identifiers: without regard to case. */
const key = (path: readonly string[]) => path.map((part) => part.toLowerCase()).join("\u0000");
const quoted = (path: readonly string[]) => path.map((part) => `"${part.replaceAll('"', '""')}"`).join(".");

interface Readable {
  readable: ReadonlySet<string>;
  names: DataSchema["tables"];
  scope: boolean;
}

/** The relations a statement may read from. Anything else in a FROM is refused. */
const RELATIONS = new Set(["BASE_TABLE", "SUBQUERY", "JOIN", "EXPRESSION_LIST", "EMPTY", "PIVOT"]);

/**
 * Why `node` may not run, or `null`. A walk of the whole parse: a subquery sits in an expression as
 * readily as in a FROM, so nothing is skipped. `ctes` are the CTE names visible where `node` is; a
 * relation is anything in a FROM, either side of a join, or a pivot's source.
 */
function refusal(node: Json, gate: Readable, ctes: ReadonlySet<string>, relation = false): string | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const why = refusal(item, gate, ctes);
      if (why) return why;
    }
    return null;
  }
  if (node === null || typeof node !== "object") return null;
  if (relation) {
    const why = relationRefusal(node, gate, ctes);
    if (why) return why;
  }
  // A CTE is visible to the ones after it, to itself (a recursive one), and to the body.
  let visible = ctes;
  const defined = (node.cte_map as { map?: { key: string; value: Json }[] } | undefined)?.map ?? [];
  for (const cte of defined) {
    if (cte.key.toLowerCase() === "scope") return "`scope` is the reader's selection: read it, do not define it.";
    visible = new Set([...visible, cte.key.toLowerCase()]);
    const why = refusal(cte.value, gate, visible);
    if (why) return why;
  }
  for (const [field, value] of Object.entries(node)) {
    if (field === "cte_map") continue;
    const from =
      field === "from_table" ||
      (node.type === "JOIN" && (field === "left" || field === "right")) ||
      (node.type === "PIVOT" && field === "source");
    const why = refusal(value, gate, visible, from);
    if (why) return why;
  }
  return null;
}

function relationRefusal(node: { [key: string]: Json }, gate: Readable, ctes: ReadonlySet<string>): string | null {
  const may = `A query reads ${[...gate.names.map(quoted), ...(gate.scope ? ["scope"] : [])].join(", ") || "no table"}, and nothing else.`;
  if (node.type === "TABLE_FUNCTION") {
    const name = (node.function as { function_name?: string } | null)?.function_name ?? "a table function";
    return `${name}() is a table function. ${may}`;
  }
  if (node.type === "SHOW_REF") return `DESCRIBE, SHOW and SUMMARIZE read the catalog; the schema you were given is the whole of it. ${may}`;
  if (!RELATIONS.has(String(node.type))) return `A ${String(node.type)} is not a relation a query may read. ${may}`;
  if (node.type !== "BASE_TABLE") return null;
  const path = [node.catalog_name, node.schema_name, node.table_name].filter((part): part is string => !!part);
  if (path.length === 1 && ctes.has(path[0]!.toLowerCase())) return null;
  return gate.readable.has(key(path)) ? null : `${quoted(path)} is not a table of the schema. ${may}`;
}
