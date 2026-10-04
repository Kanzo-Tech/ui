// A real DuckDB for tests: DuckDB-WASM's blocking Node build, over the same `.wasm` module the page
// boots, behind the page's own connector (`wasmConnector`) and a mosaic `Coordinator`, so its Arrow is
// decoded exactly as the page's is. Not part of the published build (`vite.config.ts` excludes
// `src/testing`).
//
// A fake engine cannot test a statement gate: what the gate trusts is DuckDB's own parser, so the
// only honest test of it is that parser, and of a refusal, the database it protected.

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Coordinator } from "@kanzo-tech/mosaic";
import { wasmConnector } from "@uwdata/mosaic-core";
import type { DuckDBBindings, DuckDBConnection } from "@duckdb/duckdb-wasm/blocking";

export interface TestDatabase {
  /** The page's door: what the agent and the gate are handed. */
  coordinator: Coordinator;
  /** The test's own door, past every gate: to set the database up and look at it afterwards. */
  run(sql: string): Record<string, unknown>[];
}

export async function testDatabase(): Promise<TestDatabase> {
  const require = createRequire(import.meta.url);
  const blocking = require("@duckdb/duckdb-wasm/blocking") as typeof import("@duckdb/duckdb-wasm/blocking");
  const dist = dirname(require.resolve("@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs"));
  const db: DuckDBBindings = await blocking.createDuckDB(
    {
      mvp: { mainModule: join(dist, "duckdb-mvp.wasm"), mainWorker: "" },
      eh: { mainModule: join(dist, "duckdb-eh.wasm"), mainWorker: "" },
    },
    new blocking.VoidLogger(),
    blocking.NODE_RUNTIME,
  );
  await db.instantiate(() => {});
  const connection: DuckDBConnection = db.connect();
  // The blocking connection answers the one call the connector makes of it, synchronously.
  const coordinator = new Coordinator(wasmConnector({ duckdb: db as never, connection: connection as never }), { logger: null });
  return {
    coordinator,
    run: (sql) => connection.query(sql).toArray().map((row) => row.toJSON() as Record<string, unknown>),
  };
}
