// A real DuckDB for tests: DuckDB-WASM's blocking Node build, over the same `.wasm` module the page
// boots, behind the page's own connector (`wasmConnector`) and a mosaic `Coordinator`, so its Arrow is
// decoded exactly as the page's is, and an answer is compiled and read as the page reads it. Not part
// of the published build (`vite.config.ts` excludes `src/testing`).

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Coordinator, type Engine } from "@kanzo-tech/mosaic";
import { decodeIPC, wasmConnector } from "@uwdata/mosaic-core";
import type { DuckDBBindings, DuckDBConnection } from "@duckdb/duckdb-wasm/blocking";

export interface TestDatabase {
  /** The page's door: what the agent and the card are handed. */
  coordinator: Coordinator;
  /**
   * The engine's door beside the queue, as `engine()` builds it: the statement goes to the connector
   * the coordinator holds and is decoded as the coordinator decodes, and an abort rejects with the
   * signal's reason.
   */
  engine: Pick<Engine, "query">;
  /** The test's own door: to set the database up and look at it afterwards. */
  run(sql: string): Record<string, unknown>[];
}

export async function testDatabase(): Promise<TestDatabase> {
  const require = createRequire(import.meta.url);
  const blocking = require("@duckdb/duckdb-wasm/blocking") as typeof import("@duckdb/duckdb-wasm/blocking");
  const dist = dirname(require.resolve("@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs"));
  const bundles = {
    mvp: { mainModule: join(dist, "duckdb-mvp.wasm"), mainWorker: "" },
    eh: { mainModule: join(dist, "duckdb-eh.wasm"), mainWorker: "" },
  };
  const db: DuckDBBindings = await blocking.createDuckDB(bundles, new blocking.VoidLogger(), blocking.NODE_RUNTIME);
  await db.instantiate(() => {});
  const connection: DuckDBConnection = db.connect();
  connection.query("SET autoload_known_extensions = false");
  // The blocking connection answers the one call the connector makes of it, synchronously.
  const connector = wasmConnector({ duckdb: db as never, connection: connection as never });
  const coordinator = new Coordinator(connector, { logger: null });
  // The blocking connection answers before an abort could land, so the signal is read either side.
  const query: Engine["query"] = async (sql, { signal }) => {
    signal.throwIfAborted();
    const bytes = await connector.query({ type: "arrow", sql });
    signal.throwIfAborted();
    return decodeIPC(bytes as never) as never;
  };
  return {
    coordinator,
    engine: { query },
    run: (sql) => connection.query(sql).toArray().map((row) => row.toJSON() as Record<string, unknown>),
  };
}
