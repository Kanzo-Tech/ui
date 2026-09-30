import type { GraphRootProps } from "@kanzo-tech/graph";
import type { Engine } from "@kanzo-tech/ui/analytics";

/**
 * **A stand-in for `@fossil-lang/corpus`'s `open`, as `fossil/1` specifies it.** fossil publishes the
 * real one in `0.3.0-alpha.15`; until then the docs open their corpora with this, and the day it
 * ships every import of this file becomes `import { open } from "@fossil-lang/corpus"` and the file
 * is deleted. It is the contract's steps and nothing more: fetch `fossil.json`, check its format,
 * attach a catalogue, one view per table, and a scan is one `SELECT` the engine prunes.
 */

export type Corpus = Extract<NonNullable<GraphRootProps["corpus"]>, { readonly manifest: unknown }>;
type ScanParams = Parameters<Corpus["scan"]>[0];
type Filter = NonNullable<ScanParams["filter"]>;
type Literal = Extract<Filter, { value: unknown }>["value"];

const name = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;
const text = (value: string) => `'${value.replaceAll("'", "''")}'`;

function literal(value: Literal): string {
  if (typeof value === "string") return text(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error(`a filter cannot compare against ${value}`);
  return String(value);
}

function where(filter: Filter): string {
  if ("and" in filter) return filter.and.length === 0 ? "TRUE" : `(${filter.and.map(where).join(" AND ")})`;
  if ("or" in filter) return filter.or.length === 0 ? "FALSE" : `(${filter.or.map(where).join(" OR ")})`;
  if ("not" in filter) return `(NOT ${where(filter.not)})`;
  if ("bbox" in filter) throw new Error("the stand-in reader does not filter by bbox");
  const column = name(filter.column);
  if ("values" in filter) {
    if (filter.values.length === 0) return filter.op === "in" ? "FALSE" : "TRUE";
    return `${column} ${filter.op === "in" ? "IN" : "NOT IN"} (${filter.values.map(literal).join(", ")})`;
  }
  if (!("value" in filter)) return `${column} ${filter.op === "is null" ? "IS NULL" : "IS NOT NULL"}`;
  return `${column} ${filter.op === "!=" ? "<>" : filter.op} ${literal(filter.value)}`;
}

/** `source` is the corpus's URL; its catalogue in the engine is named after it. */
export async function open(source: string, { engine }: { engine: Engine }): Promise<Corpus> {
  const url = source.replace(/\/+$/, "");
  const response = await fetch(`${url}/fossil.json`);
  if (!response.ok) throw new Error(`${url}/fossil.json: ${response.status} ${response.statusText}`);
  const manifest = (await response.json()) as Corpus["manifest"];
  if (manifest.format !== "fossil/1") throw new Error(`${url} is ${String(manifest.format)}, and this reads fossil/1`);
  const catalogue = name(url);
  await engine.query(`ATTACH IF NOT EXISTS ':memory:' AS ${catalogue}`);
  for (const table of [...manifest.vertex_tables, ...manifest.edge_tables]) {
    await engine.query(
      `CREATE OR REPLACE VIEW ${catalogue}.${name(table.name)} AS SELECT * FROM read_parquet(${text(`${url}/${table.path}`)})`,
    );
  }
  return {
    url,
    manifest,
    scan(params) {
      const statement = [
        `SELECT ${params.select ? params.select.map(name).join(", ") : "*"} FROM ${catalogue}.${name(params.table)}`,
        params.filter ? `WHERE ${where(params.filter)}` : "",
        params.limit === undefined ? "" : `LIMIT ${Math.max(0, Math.floor(params.limit))}`,
      ].join(" ");
      return {
        params,
        plan: () => [{ table: params.table }],
        read: async (tasks, options) => (tasks.length === 0 ? [] : [await engine.query(statement, options)]),
      };
    },
    close: async () => {
      await engine.query(`DETACH DATABASE IF EXISTS ${catalogue}`);
    },
  };
}
