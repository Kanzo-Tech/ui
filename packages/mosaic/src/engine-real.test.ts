// @vitest-environment node
import { realpathSync } from "node:fs";
import { Worker as NodeWorker } from "node:worker_threads";
import { queryableConformance } from "@kanzo-tech/testing";
import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * The engine against DuckDB-WASM itself, in Node: the real worker, the real pending-query protocol and
 * a real interrupt. A fake of any of them would prove only that the fake agrees with the engine, which
 * is how `engine.ts` documented a cancellation it did not have.
 *
 * **The environment is `node`, on purpose.** vitest's `jsdom` installs an `XMLHttpRequest` global, and
 * DuckDB-WASM's Node glue reaches for one the first time a Parquet statement runs: jsdom's refuses a
 * synchronous `responseType` and leaves the instance broken. With no such global the glue takes its
 * offline path and Parquet works. A test file that opens an engine must not run under jsdom.
 *
 * **What Node cannot do that a browser can**, and this file stands in for: a `Worker` that is a
 * `worker_threads` thread running DuckDB-WASM's own Node worker, and no `LOAD` of an extension from a
 * file (the glue fetches it, and a path is not a URL it can fetch). The boot's `LOAD`s and the two
 * settings that need `parquet` loaded are therefore sent as `SELECT 1`, and autoloading stays on, which
 * is how Parquet is found here. Everything else the boot sends reaches DuckDB as written.
 */
const duckdb = realpathSync(new URL("../node_modules/@duckdb/duckdb-wasm", import.meta.url));

/** What the browser build's URLs name, in the Node build that sits beside it. */
const inPackage = (path: string) =>
  path.includes("/@duckdb/duckdb-wasm/") ? `${duckdb}/${path.split("/@duckdb/duckdb-wasm/")[1]}` : path;

/** The boot's statements that need a browser: an extension named by file, and what it makes available. */
const needsBrowser = (text: string) =>
  text.startsWith("LOAD '") || text.includes("parquet_metadata_cache") || text.includes("autoload_known");

const forNode = (message: unknown): unknown =>
  JSON.parse(
    JSON.stringify(message, (_key, value: unknown) => {
      if (typeof value !== "string") return value;
      if (needsBrowser(value)) return "SELECT 1";
      return inPackage(value.replace(/^file:\/\//, ""));
    }),
  );

/** The workers this file started, so a test can end one the way a browser tab's would end. */
const started: DuckWorker[] = [];

class DuckWorker {
  private readonly thread: NodeWorker;
  private readonly listeners = new Map<(event: never) => void, (value: unknown) => void>();

  constructor(url: string) {
    const file = inPackage(new URL(url).pathname)
      .replace("duckdb-browser-", "duckdb-node-")
      .replace(/\.worker\.js$/, ".worker.cjs");
    // DuckDB-WASM's Node worker is written for the `web-worker` package's globals: `onmessage` and `postMessage`.
    this.thread = new NodeWorker(
      `const { parentPort } = require("node:worker_threads");
       globalThis.self = globalThis;
       globalThis.postMessage = (message, transfer) => parentPort.postMessage(message, transfer);
       parentPort.on("message", (data) => globalThis.onmessage && globalThis.onmessage({ data }));
       require(${JSON.stringify(file)});`,
      { eval: true },
    );
    started.push(this);
  }

  addEventListener(type: string, listener: (event: never) => void) {
    const wrapped =
      type === "message"
        ? (data: unknown) => (listener as (event: unknown) => void)({ data })
        : (error: unknown) => (listener as (event: unknown) => void)({ message: String(error), error });
    this.listeners.set(listener, wrapped);
    this.thread.on(type, wrapped);
  }

  removeEventListener(type: string, listener: (event: never) => void) {
    const wrapped = this.listeners.get(listener);
    if (wrapped) this.thread.off(type, wrapped);
  }

  postMessage(message: unknown, transfer?: ArrayBuffer[]) {
    this.thread.postMessage(forNode(message), transfer);
  }

  terminate() {
    return this.thread.terminate();
  }

  /** What a browser delivers when the worker dies under a page: an `error` event on the worker. */
  crash(message: string) {
    this.thread.emit("error", new Error(message));
  }
}

vi.stubGlobal("Worker", DuckWorker);
vi.stubGlobal("location", new URL("file:///page/"));

const { engine } = await import("./engine.js");

afterAll(() => {
  for (const worker of started) void worker.terminate();
});

const signal = () => new AbortController().signal;
const elapsed = async (run: () => Promise<unknown>) => {
  const from = performance.now();
  await run();
  return performance.now() - from;
};

/** Far longer than any test waits: the statement only ends if the engine interrupts it. */
const LONG = "SELECT sum(i * i) FROM range(1000000000) t(i)";

describe("the engine on DuckDB-WASM", () => {
  it("answers in columns", async () => {
    const e = await engine();
    const table = await e.query("SELECT 41 + 1 AS answer, NULL::INTEGER AS nothing", { signal: signal() });
    expect(table.numRows).toBe(1);
    expect(table.schema.fields.map((field) => field.name)).toEqual(["answer", "nothing"]);
    expect(table.getChild("answer")?.get(0)).toBe(42);
    expect(table.getChild("nothing")?.get(0)).toBeNull();
  }, 30_000);

  it("reads a result of a million rows whole", async () => {
    const e = await engine();
    const table = await e.query("SELECT i, i * 2.5 AS d FROM range(1000000) t(i)", { signal: signal() });
    expect(table.numRows).toBe(1_000_000);
    expect(table.getChild("d")?.get(999_999)).toBe(2_499_997.5);
  }, 30_000);

  // The defect: Stop said stopped, and the page stayed stuck for the seconds the statement had left.
  it("interrupts a long statement on abort, so the next one answers at once", async () => {
    const e = await engine();
    const controller = new AbortController();
    const stop = new Error("stop");
    const long = e.query(LONG, { signal: controller.signal });
    setTimeout(() => controller.abort(stop), 100);
    await expect(long).rejects.toBe(stop);
    const next = await elapsed(() => e.query("SELECT 1 AS one", { signal: signal() }));
    expect(next).toBeLessThan(200);
  }, 30_000);

  it("takes the next statement from the queue after an interrupted one, in order", async () => {
    const e = await engine();
    const controller = new AbortController();
    const long = e.query(LONG, { signal: controller.signal });
    const after = e.query("SELECT 7 AS seven", { signal: signal() });
    const stop = new Error("stop");
    setTimeout(() => controller.abort(stop), 100);
    await expect(long).rejects.toBe(stop);
    expect((await after).getChild("seven")?.get(0)).toBe(7);
  }, 30_000);

  it("shares the connection with the coordinator's statements", async () => {
    const e = await engine();
    await e.coordinator.exec("CREATE OR REPLACE TEMP TABLE shared AS SELECT 5 AS five");
    expect((await e.query("SELECT five FROM shared", { signal: signal() })).getChild("five")?.get(0)).toBe(5);
  }, 30_000);

  // DuckDB's message repeats the statement it refused; nothing of a value may reach `onFailure`.
  it("refuses a failing statement and a failing CREATE SECRET without a literal or a secret in them", async () => {
    const e = await engine();
    const everything = (error: unknown) => JSON.stringify(error, Object.getOwnPropertyNames(error as object));

    const select = await e
      .query("SELECT * FROM nowhere WHERE name = 'Ada Lovelace' AND id IN (7, 8)", { signal: signal() })
      .catch((error: unknown) => error);
    expect(select).toMatchObject({
      code: "engine/failed",
      data: { statement: "SELECT * FROM nowhere WHERE name = ? AND id IN (?)" },
    });
    expect(everything(select)).not.toMatch(/Ada|Lovelace/);

    const secret = await e
      .query("CREATE SECRET leaky (TYPE nosuchtype, KEY_ID 'AKIAEXAMPLE', SECRET 'hunter2')", { signal: signal() })
      .catch((error: unknown) => error);
    expect(secret).toMatchObject({ code: "engine/failed", data: {} });
    expect(everything(secret)).not.toMatch(/AKIAEXAMPLE|hunter2|KEY_ID/);
  }, 30_000);

  // Below WebAssembly's ceiling, so DuckDB spills or refuses while the worker lives.
  it("runs under a memory limit of its own", async () => {
    const e = await engine();
    const table = await e.query("SELECT current_setting('memory_limit') AS memory", { signal: signal() });
    expect(String(table.getChild("memory")?.get(0))).toMatch(/GiB$/);
  }, 30_000);

  it("rejects a statement the worker died under with engine/lost, and boots another engine on the next ask", async () => {
    const e = await engine();
    const worker = started.at(-1)!;
    const long = e.query(LONG, { signal: signal() }).catch((error: unknown) => error);
    await new Promise((next) => setTimeout(next, 100));
    worker.crash("the worker crashed");
    expect(await long).toMatchObject({ code: "engine/lost", data: { reason: "worker" } });
    await expect(e.query("SELECT 1", { signal: signal() })).rejects.toMatchObject({ code: "engine/lost" });

    const again = await engine();
    expect(again).not.toBe(e);
    expect((await again.query("SELECT 2 AS two", { signal: signal() })).getChild("two")?.get(0)).toBe(2);
  }, 60_000);
});

// The same cases every engine and every double of one is held to; the death case kills the worker the
// way a browser would report it, and the next case asks `engine()` again for the one that replaced it.
describe("the engine, held to the Queryable conformance kit", () => {
  const make = async () => {
    const e = await engine();
    const worker = started.at(-1)!;
    return { queryable: e, kill: () => worker.crash("the worker crashed") };
  };
  for (const { name, run } of queryableConformance(make)) it(name, run, 60_000);
});
