import type { GraphRootProps } from "@kanzo-tech/graph";
import type { Engine } from "@kanzo-tech/ui/analytics";

/**
 * **A stand-in for `@fossil-lang/corpus`'s `open`, as `fossil/1` specifies it** — the steps of
 * fossil's `src/open.ts` for a corpus at a URL, and nothing more: read `fossil.json` through the
 * engine, check its format, attach a catalogue named as `source` was given, one view per table, and a
 * scan is one `SELECT` the engine prunes. fossil publishes the real one in `0.3.0-alpha.15`; the day
 * it ships every import of this file becomes `import { open } from "@fossil-lang/corpus"` and the
 * file is deleted.
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

/** `source` is the corpus's URL; its catalogue in the engine is named `source`, as given. */
export async function open(source: string, { engine }: { engine: Engine }): Promise<Corpus> {
  const base = source.endsWith("/") ? source : `${source}/`;
  const answer = await engine.query(`SELECT content FROM read_text(${text(`${base}fossil.json`)})`);
  const manifest = JSON.parse(String(answer.getChild("content")?.toArray()[0])) as Corpus["manifest"];
  if (manifest.format !== "fossil/1") throw new Error(`${base}fossil.json is ${String(manifest.format)}, and this reads fossil/1`);
  const catalogue = name(source);
  await engine.query(`ATTACH IF NOT EXISTS ':memory:' AS ${catalogue}`);
  for (const table of [...manifest.vertex_tables, ...manifest.edge_tables]) {
    await engine.query(
      `CREATE OR REPLACE VIEW ${catalogue}.${name(table.name)} AS SELECT * FROM read_parquet(${text(`${base}${table.path}`)})`,
    );
  }
  return {
    url: source,
    manifest,
    scan(params) {
      const statement = [
        `SELECT ${params.select ? params.select.map(name).join(", ") : "*"} FROM ${catalogue}.${name(params.table)}`,
        params.filter ? `WHERE ${where(params.filter)}` : "",
        params.limit === undefined ? "" : `LIMIT ${Math.max(0, Math.floor(params.limit))}`,
      ].join(" ");
      return {
        params,
        plan: () => {
          const table = [...manifest.vertex_tables, ...manifest.edge_tables].find((t) => t.name === params.table);
          return [{ table: params.table, path: table?.path ?? "", rows: table?.record_count ?? 0 }];
        },
        read: async (tasks, options) => (tasks.length === 0 ? [] : [await engine.query(statement, options)]),
      };
    },
    close: async () => {
      await engine.query(`DETACH DATABASE IF EXISTS ${catalogue}`);
    },
  };
}
