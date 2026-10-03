import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { ConsoleLogger, LogLevel, NODE_RUNTIME, createDuckDB, type DuckDBBindings, type DuckDBConnection } from "@duckdb/duckdb-wasm/blocking";
import { decodeIPC } from "@uwdata/mosaic-core";
import { Coordinator } from "@kanzo-tech/mosaic";

/**
 * **A corpus attached the way fossil's `open` attaches one**, in a real DuckDB-WASM in this process,
 * read through a real Mosaic `Coordinator` — so what the graph's SQL means is what DuckDB answers,
 * not what a fake believes. Small enough to count by hand:
 *
 * - `Person`: ids `0 … 9`, `name` `Person i`, `team = i % 4`, `score = i + 1`, `lon = i`, `lat = 0`.
 * - `Place`: ids `10 … 15`, `name` `Place i`, `lon = i`, `lat = 1`.
 * - `Tag`: ids `16 … 19`, its `subject` and nothing else.
 * - `Person_knows_Person` links `i → i + 1` (9); `Person_livesIn_Place` links `i → 10 + i % 6` (10);
 *   `Person_tagged_Tag` links `0 → 16` (1).
 */

const require = createRequire(import.meta.url);

let booted: Promise<{ db: DuckDBBindings; conn: DuckDBConnection }> | null = null;

/** One database per test file: instantiating the module is the cost, not a catalog. */
function boot() {
  booted ??= (async () => {
    const dist = dirname(require.resolve("@duckdb/duckdb-wasm"));
    const db = await createDuckDB(
      {
        mvp: { mainModule: resolve(dist, "duckdb-mvp.wasm"), mainWorker: resolve(dist, "duckdb-node-mvp.worker.cjs") },
        eh: { mainModule: resolve(dist, "duckdb-eh.wasm"), mainWorker: resolve(dist, "duckdb-node-eh.worker.cjs") },
      },
      new ConsoleLogger(LogLevel.ERROR),
      NODE_RUNTIME,
    );
    await db.instantiate();
    return { db, conn: db.connect() };
  })();
  return booted;
}

export interface Attached {
  /** The page's coordinator, over this process's DuckDB. */
  readonly coordinator: Coordinator;
  /** The catalog the corpus is attached under — what `from` names. */
  readonly from: string;
  /** Every statement the coordinator sent, in order. */
  readonly sent: string[];
  /** How many of them have been answered, or refused. */
  readonly answered: { readonly count: number };
  /** Make the next statement matching `pattern` fail with `error`, as a storage refusal would. */
  refuse(pattern: RegExp, error: unknown): void;
}

let catalogs = 0;

const FIXTURE = (c: string) => `
ATTACH ':memory:' AS ${c};
CREATE TABLE ${c}."Person" AS SELECT i::UBIGINT AS dense_id, 'https://example.org/person/' || i AS subject,
  'Person ' || i AS name, (i % 4)::INTEGER AS team, (i + 1)::INTEGER AS score, i::DOUBLE AS lon, 0::DOUBLE AS lat
  FROM range(10) t(i);
CREATE TABLE ${c}."Place" AS SELECT (10 + i)::UBIGINT AS dense_id, 'https://example.org/place/' || i AS subject,
  'Place ' || i AS name, i::DOUBLE AS lon, 1::DOUBLE AS lat FROM range(6) t(i);
CREATE TABLE ${c}."Tag" AS SELECT (16 + i)::UBIGINT AS dense_id, 'https://example.org/tag/' || i AS subject FROM range(4) t(i);
CREATE TABLE ${c}."Person_knows_Person" AS SELECT i::UBIGINT AS src, (i + 1)::UBIGINT AS dst FROM range(9) t(i);
CREATE TABLE ${c}."Person_livesIn_Place" AS SELECT i::UBIGINT AS src, (10 + i % 6)::UBIGINT AS dst FROM range(10) t(i);
CREATE TABLE ${c}."Person_tagged_Tag" AS SELECT 0::UBIGINT AS src, 16::UBIGINT AS dst;
CREATE VIEW ${c}.fossil_tables AS SELECT * FROM (VALUES
  ('Person', 'vertex', 'https://example.org/Person', 10::UBIGINT, 0::UBIGINT, NULL, NULL),
  ('Place', 'vertex', 'https://example.org/Place', 6::UBIGINT, 10::UBIGINT, NULL, NULL),
  ('Tag', 'vertex', 'https://example.org/Tag', 4::UBIGINT, 16::UBIGINT, NULL, NULL),
  ('Person_knows_Person', 'edge', 'https://example.org/knows', 9::UBIGINT, NULL, 'Person', 'Person'),
  ('Person_livesIn_Place', 'edge', 'https://example.org/livesIn', 10::UBIGINT, NULL, 'Person', 'Place'),
  ('Person_tagged_Tag', 'edge', 'https://example.org/tagged', 1::UBIGINT, NULL, 'Person', 'Tag')
) t(table_name, kind, iri, rows, first_id, source, destination);
CREATE VIEW ${c}.fossil_columns AS
  SELECT table_name, column_name, column_index AS ordinal,
    CASE data_type WHEN 'DOUBLE' THEN 'double' WHEN 'INTEGER' THEN 'int32' WHEN 'UBIGINT' THEN 'uint64'
                   WHEN 'VARCHAR' THEN 'string' END AS type,
    CASE WHEN column_name = 'dense_id' THEN 'address' WHEN column_name = 'subject' THEN 'identity'
         WHEN column_name IN ('src', 'dst') THEN 'endpoint' END AS role,
    NULL AS iri, is_nullable AS nullable
  FROM duckdb_columns() WHERE database_name = '${c}';
`;

/** A fresh catalog holding the corpus above, and a coordinator of its own over the shared database. */
export async function attach(): Promise<Attached> {
  const { conn } = await boot();
  const from = `corpus${++catalogs}`;
  conn.query(FIXTURE(from));
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
  return { coordinator, from, sent, answered, refuse: (pattern, error) => refusals.push({ pattern, error }) };
}

/** What fossil's storage rejects with: an `Error` carrying a code. */
export const refusal = () => Object.assign(new Error("the bucket did not answer"), { code: "storage/unreachable" });

/**
 * Until every statement sent has been answered and nothing new was sent for a few turns — counted,
 * not timed, so a slow runner waits for the answer rather than for a quiet that came too early.
 */
export async function settle(attached: Attached): Promise<void> {
  let seen = -1;
  for (let quiet = 0, round = 0; quiet < 4 && round < 2000; round++) {
    await new Promise((next) => setTimeout(next, 5));
    const done = attached.answered.count === attached.sent.length;
    quiet = done && attached.sent.length === seen ? quiet + 1 : 0;
    seen = attached.sent.length;
  }
}
