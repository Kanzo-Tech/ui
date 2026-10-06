// A real DuckDB for tests: DuckDB-WASM's blocking Node build, over the same `.wasm` module the page
// boots, behind the page's own connector (`wasmConnector`) and a mosaic `Coordinator`, so its Arrow is
// decoded exactly as the page's is. Not part of the published build (`vite.config.ts` excludes
// `src/testing`).
//
// A fake engine cannot test a statement gate: what the gate trusts is DuckDB's own parser, so the
// only honest test of it is that parser, and of a refusal, the database it protected.
//
// It loads `json` as the page's engine does: the pinned build `@kanzo-tech/mosaic` ships, by URL
// (`./extensions.ts` serves it), for the bundle that booted, with autoloading off, so a statement that
// needs an extension nobody loaded fails here as it would on the page. Not under jsdom: DuckDB-WASM
// loads through `XMLHttpRequest` wherever one exists, synchronously and as an `arraybuffer`, which
// the XHR standard refuses a window (`InvalidAccessError`) — the page's engine runs in a worker, where
// it is allowed. A test that renders gets the database without `json`, and says so if it needs it.

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Coordinator } from "@kanzo-tech/mosaic";
import { wasmConnector } from "@uwdata/mosaic-core";
import { inject } from "vitest";
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
  const bundles = {
    mvp: { mainModule: join(dist, "duckdb-mvp.wasm"), mainWorker: "" },
    eh: { mainModule: join(dist, "duckdb-eh.wasm"), mainWorker: "" },
  };
  const { mainModule } = await blocking.selectBundle(bundles);
  const json = inject("json")[mainModule === bundles.eh.mainModule ? "wasm_eh" : "wasm_mvp"];
  const db: DuckDBBindings = await blocking.createDuckDB(bundles, new blocking.VoidLogger(), blocking.NODE_RUNTIME);
  await db.instantiate(() => {});
  const connection: DuckDBConnection = db.connect();
  connection.query("SET autoload_known_extensions = false");
  if (typeof XMLHttpRequest === "undefined") connection.query(`LOAD '${json}'`);
  // The blocking connection answers the one call the connector makes of it, synchronously.
  const coordinator = new Coordinator(wasmConnector({ duckdb: db as never, connection: connection as never }), { logger: null });
  return {
    coordinator,
    run: (sql) => connection.query(sql).toArray().map((row) => row.toJSON() as Record<string, unknown>),
  };
}
