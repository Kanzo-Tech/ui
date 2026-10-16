import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConsoleLogger, LogLevel, NODE_RUNTIME, createDuckDB } from "@duckdb/duckdb-wasm/blocking";
import { attachGraph, type GraphAttachment } from "@kanzo-tech/graphar-duckdb";
import type { Queryable, Table } from "@kanzo-tech/kernel";

/**
 * **The fixture graphs, and the one door a test reaches them through.** Each is a sample of a dataset
 * — the Nobel laureates, OpenFlights' airports and routes, LDBC SNB — written to a GraphAr graph by
 * fossil's executor (`write.mjs`) and checked in under `graphs/<name>/graph/`, then attached here the
 * way a page attaches one: `@kanzo-tech/graphar-duckdb`'s `attachGraph`, on DuckDB-WASM, in this
 * process. What a test reads is what the writer wrote and what the attach made of it; nothing is
 * stated by hand (`/docs/design/testing#a-test-reads-from-one-real-engine-and-a-models-test-replays-a-recording`).
 */
export type FixtureGraph = "nobel" | "openflights" | "snb";

const require = createRequire(import.meta.url);

/**
 * **One database per test file, instantiated when this module is imported.** Compiling DuckDB-WASM
 * is the cost here, not an attach: about 0.3 s alone, and several seconds when every package's suite
 * runs at once on a CI runner's few cores. Paid inside a test, it landed on whichever ran first and
 * pushed it past vitest's 5 s budget. Top-level `await` pays it while the file is collected, before
 * any test's clock starts, and only in the files that import this module.
 */
export const database = await createDuckDB(
  (() => {
    const dist = dirname(require.resolve("@duckdb/duckdb-wasm"));
    return {
      mvp: { mainModule: resolve(dist, "duckdb-mvp.wasm"), mainWorker: resolve(dist, "duckdb-node-mvp.worker.cjs") },
      eh: { mainModule: resolve(dist, "duckdb-eh.wasm"), mainWorker: resolve(dist, "duckdb-node-eh.worker.cjs") },
    };
  })(),
  new ConsoleLogger(LogLevel.ERROR),
  NODE_RUNTIME,
);
await database.instantiate();

/**
 * The blocking connection every engine of this file answers through. DuckDB-WASM's Node runtime
 * reads and writes through the file system, so a path is a name `read_parquet` reads.
 */
export const connection = database.connect();

/**
 * **Parquet opens in Node only without an `XMLHttpRequest` global.** DuckDB-WASM loads its `parquet`
 * extension on first use, and when the global exists it downloads the extension with a synchronous
 * request; jsdom's `XMLHttpRequest` refuses one, and the instance is broken from then on. With no such
 * global the extension is already part of the build, so nothing is fetched. It is therefore loaded
 * here once, with the global taken away, before any test runs — so a `jsdom` test file may import
 * this module too.
 */
{
  const host = globalThis as { XMLHttpRequest?: unknown };
  const xhr = host.XMLHttpRequest;
  host.XMLHttpRequest = undefined;
  try {
    const warm = join(graphOf("openflights"), "vertex");
    connection.query(`SELECT count(*) FROM read_parquet('${warm}/*/*/chunk*')`);
  } finally {
    host.XMLHttpRequest = xhr;
  }
}

/** Where the graph `name` is on disk: the directory holding its `fossil.graph.yml`. */
export function graphOf(name: FixtureGraph): string {
  // A path, not `new URL(…, import.meta.url)`: under jsdom `URL` is jsdom's, which Node's
  // `fileURLToPath` does not read.
  return join(dirname(fileURLToPath(import.meta.url)), "..", "graphs", name, "graph");
}

/**
 * A `Queryable` over {@link connection}, recording every statement it is sent. The blocking
 * connection answers before an abort could land, so it reads the signal either side of the statement.
 */
export function queryable(): Queryable & { readonly sent: string[] } {
  const sent: string[] = [];
  return {
    sent,
    async query(sql, { signal }) {
      signal.throwIfAborted();
      sent.push(sql);
      const table = connection.query(sql) as unknown as Table;
      signal.throwIfAborted();
      return table;
    },
  };
}

let attached = 0;

/**
 * Attaches the fixture graph `name` through `engine` under a catalog of its own — a fresh name each
 * call, so a test that alters one leaves the next untouched — resolving each of the graph's files to
 * its path on disk.
 */
export function attachFixture(name: FixtureGraph, engine: Queryable): Promise<GraphAttachment> {
  const root = graphOf(name);
  return attachGraph(engine, `${name}${++attached}`, (paths) => paths.map((path) => join(root, path)), { entry: "fossil.graph.yml" });
}
