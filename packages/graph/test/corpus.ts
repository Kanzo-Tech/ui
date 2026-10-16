import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connection as conn } from "@kanzo-tech/fixtures";
import { afterAll } from "vitest";
import { decodeIPC } from "@uwdata/mosaic-core";
import { Coordinator } from "@kanzo-tech/mosaic";
import { internalEngineOver, type Engine } from "@kanzo-tech/mosaic/engine";

/**
 * **A graph attached the way `@kanzo-tech/graphar-duckdb`'s `attachGraph` attaches one**, in a real
 * DuckDB-WASM in this process, read through an engine with a real Mosaic `Coordinator` inside — so what the graph's SQL
 * means is what DuckDB answers, not what a fake believes. A relation per type with GraphAr's own
 * columns, and the information files as `graphar_vertex_types`, `graphar_edge_types`,
 * `graphar_properties`, `graphar_extra_info` and `graphar_chunks`, typed as `attachGraph` types them,
 * with a real Parquet chunk, footer and all, per vertex type (see below). Small enough to
 * count by hand, in global ids:
 *
 * - `Person`: ids `0 … 9`, `subject` its primary key, `name` `Person i`, `team = i % 4`,
 *   `score = i + 1`, `lon = i`, `lat = 0`, `born = 1900 + i`, and `nickname`, a `list<string>`
 *   property holding `nick i` — a multi-valued property is a list of the type that owns it.
 * - `Place`: ids `10 … 15`, `name` `Place i`, `lon = i`, `lat = 1`, `opened` the first of January of
 *   `2000 + i`, a GraphAr `date`.
 * - `Tag`: ids `16 … 19`, its `subject` and nothing else.
 * - `Person_knows_Person` links `i → i + 1` (9); `Person_livesIn_Place` links `i → 10 + i % 6` (10);
 *   `Person_tagged_Tag` links `0 → 16` (1). Each holds GraphAr's per-type indices.
 */

/**
 * **Footers are real.** Every vertex chunk is a Parquet file this module writes with DuckDB-WASM
 * (`COPY … TO … (FORMAT parquet, COMPRESSION zstd, KV_METADATA {'fossil:stats': …})`), so
 * `parquet_kv_metadata` and `parquet_metadata` read what a writer's file holds. The key under which a
 * writer states its counts is a Parquet `key_value_metadata` key; a chunk's row group states each
 * column's nulls, bounds and whether they are exact.
 *
 * The database is `@kanzo-tech/fixtures`' — one per test file, Parquet loaded before any test runs — and
 * so is the engine every fixture graph is read on; this graph is the one stated here.
 */
const STATS_KEY = "fossil:stats";
/** Where the chunks are written: DuckDB-WASM's Node runtime writes through the file system, so not the working directory. */
const chunks = mkdtempSync(join(tmpdir(), "graph-chunks-"));
afterAll(() => rmSync(chunks, { force: true, recursive: true }));
/**
 * Write `type`'s rows of the catalog `from` as the Parquet chunk `file`, stating `stats` under the
 * writer's key, or nothing when it is `null`.
 */
export function writeChunk(file: string, from: string, type: string, stats: string | null): void {
  const kv = stats === null ? "" : `, KV_METADATA {'${STATS_KEY}': '${stats.replace(/'/g, "''")}'}`;
  conn.query(`COPY (SELECT * FROM ${from}."${type}") TO '${file}' (FORMAT parquet, COMPRESSION zstd${kv});`);
}

export interface Attached {
  /**
   * The page's engine over this process's DuckDB: `query` and the coordinator inside it share one
   * connector, so `sent` sees both doors. The blocking connection answers before an abort could land,
   * so `query` reads the signal either side of the statement.
   */
  readonly engine: Engine;
  /** The coordinator inside `engine`, for a test that connects Mosaic clients of its own, as a chart would. */
  readonly coordinator: Coordinator;
  /** The catalog the graph is attached under — what `from` names. */
  readonly from: string;
  /** Every statement the engine sent, through either door, in order. */
  readonly sent: string[];
  /** How many of them have been answered, or refused. */
  readonly answered: { readonly count: number };
  /** How many queries the engine was asked, through either door, and how many of those have settled. */
  readonly asked: { readonly count: number; readonly settled: number };
  /** Make the next statement matching `pattern` fail with `error`, as a storage refusal would. */
  refuse(pattern: RegExp, error: unknown): void;
}

let catalogs = 0;

/** Each type's properties as `graphar_properties` lists them: name, GraphAr type, primary. */
const PROPERTIES: Record<string, [string, string, boolean][]> = {
  Person: [["subject", "string", true], ["name", "string", false], ["team", "int32", false], ["score", "int32", false],
    ["lon", "double", false], ["lat", "double", false], ["born", "int32", false], ["nickname", "list<string>", false]],
  Place: [["subject", "string", true], ["name", "string", false], ["lon", "double", false], ["lat", "double", false], ["opened", "date", false]],
  Tag: [["subject", "string", true]],
};

/**
 * What the writer counts in a chunk's footer, per column — nulls, distinct values, extent and the ten
 * commonest values with their share of the rows — over every row, here by DuckDB.
 */
const STATS = (c: string) =>
  Object.entries(PROPERTIES)
    .flatMap(([table, columns]) =>
      columns.map(
        ([column]) => `SELECT '${table}' AS table_name, '${column}' AS column_name,
  count(*) FILTER (WHERE "${column}" IS NULL)::UBIGINT AS null_count, count(DISTINCT "${column}")::UBIGINT AS distinct_count,
  min("${column}")::VARCHAR AS min_value, max("${column}")::VARCHAR AS max_value,
  (SELECT list(v ORDER BY n DESC, v) FROM (SELECT "${column}"::VARCHAR AS v, count(*) AS n FROM ${c}."${table}" GROUP BY 1 ORDER BY n DESC, v LIMIT 10)) AS most_common_vals,
  (SELECT list(n / (SELECT count(*) FROM ${c}."${table}") ORDER BY n DESC, v) FROM (SELECT "${column}"::VARCHAR AS v, count(*)::DOUBLE AS n FROM ${c}."${table}" GROUP BY 1 ORDER BY n DESC, v LIMIT 10)) AS most_common_freqs
FROM ${c}."${table}"`,
      ),
    )
    .join("\nUNION ALL ");

const FIXTURE = (c: string, n: number) => `
ATTACH ':memory:' AS ${c};
CREATE TABLE ${c}."Person" AS SELECT i::BIGINT AS _graphArVertexIndex, 'https://example.org/person/' || i AS subject,
  'Person ' || i AS name, (i % 4)::INTEGER AS team, (i + 1)::INTEGER AS score, i::DOUBLE AS lon, 0::DOUBLE AS lat,
  (1900 + i)::INTEGER AS born, ['nick ' || i] AS nickname
  FROM range(${n}) t(i);
CREATE TABLE ${c}."Place" AS SELECT i::BIGINT AS _graphArVertexIndex, 'https://example.org/place/' || i AS subject,
  'Place ' || i AS name, i::DOUBLE AS lon, 1::DOUBLE AS lat, make_date(2000 + i::INTEGER, 1, 1) AS opened FROM range(6) t(i);
CREATE TABLE ${c}."Tag" AS SELECT i::BIGINT AS _graphArVertexIndex, 'https://example.org/tag/' || i AS subject FROM range(4) t(i);
CREATE TABLE ${c}."Person_knows_Person" AS SELECT i::BIGINT AS _graphArSrcIndex, (i + 1)::BIGINT AS _graphArDstIndex FROM range(9) t(i);
CREATE TABLE ${c}."Person_livesIn_Place" AS SELECT i::BIGINT AS _graphArSrcIndex, (i % 6)::BIGINT AS _graphArDstIndex FROM range(10) t(i);
CREATE TABLE ${c}."Person_tagged_Tag" AS SELECT 0::BIGINT AS _graphArSrcIndex, 0::BIGINT AS _graphArDstIndex;
CREATE VIEW ${c}.graphar_vertex_types AS SELECT * FROM (VALUES
  ('Person', ${n}::UBIGINT, 1), ('Place', 6::UBIGINT, 2), ('Tag', 4::UBIGINT, 3)
) t(type, count, ordinal);
CREATE VIEW ${c}.graphar_edge_types AS SELECT * FROM (VALUES
  ('Person_knows_Person', 'Person', 'knows', 'Person', 9::UBIGINT, true, 1),
  ('Person_livesIn_Place', 'Person', 'livesIn', 'Place', 10::UBIGINT, true, 2),
  ('Person_tagged_Tag', 'Person', 'tagged', 'Tag', 1::UBIGINT, true, 3)
) t(name, src_type, edge_type, dst_type, count, directed, ordinal);
CREATE VIEW ${c}.graphar_properties AS SELECT * FROM (VALUES
  ${Object.entries(PROPERTIES)
    .flatMap(([type, properties]) => properties.map(([name, dataType, primary], i) => `('${type}', '${name}', '${dataType}', ${primary}, ${!primary}, ${i + 1})`))
    .join(",\n  ")}
) t(type, property, data_type, is_primary, is_nullable, ordinal);
CREATE VIEW ${c}.graphar_extra_info AS SELECT * FROM (VALUES ('http://w3id.org/rml/', 'mapping.ttl')) t(key, value);
CREATE VIEW ${c}.footer_stats AS ${STATS(c)};
`;

/** The chunk of `type` in the catalog `c`: the name `attachGraph`'s `resolve` would have given it. */
export const chunkOf = (c: string, type: string, k = 0) => join(chunks, `${c}_${type}_chunk${k}.parquet`);

/**
 * A fresh catalog holding the graph above, and an engine of its own over the shared database.
 * `people` grows `Person` for a test about scale; the other types follow it, global ids shifted.
 */
export async function attach(people = 10): Promise<Attached> {
  const from = `graph${++catalogs}`;
  conn.query(FIXTURE(from, people));
  const json = conn
    .query(
      `SELECT table_name, '{' || string_agg('"' || column_name || '":{"distinct_count":' || distinct_count || ',"most_common_vals":['
        || array_to_string(list_transform(most_common_vals, x -> '"' || replace(x, '"', '\\"') || '"'), ',')
        || '],"most_common_freqs":[' || array_to_string(most_common_freqs, ',') || ']}', ',') || '}' AS stats
       FROM ${from}.footer_stats GROUP BY table_name`,
    )
    .toArray() as { table_name: string; stats: string }[];
  for (const { table_name, stats } of json) writeChunk(chunkOf(from, table_name), from, table_name, stats);
  conn.query(`CREATE VIEW ${from}.graphar_chunks AS SELECT * FROM (VALUES
    ${Object.keys(PROPERTIES).map((type) => `('${type}', 'vertex', '${chunkOf(from, type)}')`).join(",\n    ")}
  ) t(type, kind, path);`);
  const sent: string[] = [];
  const answered = { count: 0 };
  const refusals: { pattern: RegExp; error: unknown }[] = [];
  const connector = {
    async query(request: { type?: string; sql: string }) {
      sent.push(request.sql);
      try {
        return await answer(request);
      } finally {
        answered.count++;
      }
    },
  };
  async function answer({ type, sql }: { type?: string; sql: string }) {
    {
      // A turn of the event loop, as a worker's answer takes: nothing here answers synchronously.
      await new Promise((next) => setTimeout(next, 0));
      const refused = refusals.findIndex((r) => r.pattern.test(sql));
      if (refused >= 0) throw refusals.splice(refused, 1)[0]?.error;
      if (type === "exec") {
        conn.query(sql);
        return undefined;
      }
      // A connector answers Arrow as IPC bytes, which mosaic-core decodes itself (from 0.30).
      const bytes = conn.useUnsafe((bindings, id) => bindings.runQuery(id, sql));
      return type === "json" ? decodeIPC(bytes).toArray() : bytes;
    }
  }
  const coordinator = new Coordinator(connector as never, { logger: null });
  // Mosaic consolidates a query on the next animation frame before the connector sees it, so the
  // connector alone cannot tell a quiet from a frame that has not run yet: count at the manager too.
  const asked = { count: 0, settled: 0 };
  const request = coordinator.manager.request.bind(coordinator.manager);
  coordinator.manager.request = (entry, priority) => {
    asked.count++;
    const result = request(entry, priority);
    const settled = () => void asked.settled++;
    result.then(settled, settled);
    return result;
  };
  const query: Engine["query"] = async (sql, { signal }) => {
    asked.count++;
    try {
      signal.throwIfAborted();
      const bytes = (await connector.query({ type: "arrow", sql })) as Uint8Array;
      signal.throwIfAborted();
      return decodeIPC(bytes) as never;
    } finally {
      asked.settled++;
    }
  };
  const unused = () => Promise.reject(new Error("the corpus registers no files"));
  const engine = internalEngineOver({ query, registerFiles: unused, registerFileBuffer: unused, dropFiles: unused }, coordinator);
  return { engine, coordinator, from, sent, answered, asked, refuse: (pattern, error) => refusals.push({ pattern, error }) };
}

/** What a host's storage rejects with: an `Error` carrying a code. */
export const refusal = () => Object.assign(new Error("the bucket did not answer"), { code: "storage/unreachable" });

/**
 * Until every query asked of the engine has settled, every statement sent has been answered, and
 * nothing new was asked for a few turns — counted, not timed, so a slow runner waits for the answer
 * rather than for a quiet that came too early. Counting at the manager is what covers a query still
 * waiting on its frame, which the connector has not seen yet.
 */
export async function settle(attached: Attached): Promise<void> {
  let seen = -1;
  for (let quiet = 0, round = 0; quiet < 4 && round < 2000; round++) {
    await new Promise((next) => setTimeout(next, 5));
    const { asked, answered, sent } = attached;
    const done = asked.settled === asked.count && answered.count === sent.length;
    quiet = done && asked.count === seen ? quiet + 1 : 0;
    seen = asked.count;
  }
}
