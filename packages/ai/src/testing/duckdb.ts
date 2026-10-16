// A real DuckDB for tests: `@kanzo-tech/fixtures`' — DuckDB-WASM's blocking Node build, one per test
// file, over the same `.wasm` module the page boots — behind the page's own connector
// (`wasmConnector`) and a mosaic `Coordinator`, so its Arrow is decoded exactly as the page's is, and
// an answer is compiled and read as the page reads it. Not part of the published build
// (`vite.config.ts` excludes `src/testing`).

import { connection, database } from "@kanzo-tech/fixtures";
import { Coordinator } from "@kanzo-tech/mosaic";
import { internalEngineOver, type Engine } from "@kanzo-tech/mosaic/engine";
import { decodeIPC, wasmConnector } from "@uwdata/mosaic-core";

export interface TestDatabase {
  /**
   * The page's engine, as `engine()` builds it: what the agent, the card and `MosaicProvider` are
   * handed. `query` goes to the connector the coordinator inside it holds and is decoded as the
   * coordinator decodes, and an abort rejects with the signal's reason.
   */
  engine: Engine;
  /** The coordinator inside `engine`, for a test that asks it directly, as a chart would. */
  coordinator: Coordinator;
  /** The test's own door: to set the database up and look at it afterwards. */
  run(sql: string): Record<string, unknown>[];
}

export async function testDatabase(): Promise<TestDatabase> {
  connection.query("SET autoload_known_extensions = false");
  // The blocking connection answers the one call the connector makes of it, synchronously.
  const connector = wasmConnector({ duckdb: database as never, connection: connection as never });
  const coordinator = new Coordinator(connector, { logger: null });
  // The blocking connection answers before an abort could land, so the signal is read either side.
  const query: Engine["query"] = async (sql, { signal }) => {
    signal.throwIfAborted();
    const bytes = await connector.query({ type: "arrow", sql });
    signal.throwIfAborted();
    return decodeIPC(bytes as never) as never;
  };
  const unused = () => Promise.reject(new Error("the test database registers no files"));
  return {
    coordinator,
    engine: internalEngineOver({ query, registerFiles: unused, registerFileBuffer: unused, dropFiles: unused }, coordinator),
    run: (sql) => connection.query(sql).toArray().map((row) => row.toJSON() as Record<string, unknown>),
  };
}
