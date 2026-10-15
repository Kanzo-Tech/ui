import { beforeEach, describe, expect, it, vi } from "vitest";
import { tableFromArrays, tableToIPC } from "@uwdata/flechette";

/**
 * A registry that refuses what DuckDB-WASM refuses: a name registered again under a different URL.
 * That rule is the defect `registerFiles` exists for, so a fake without it would prove nothing.
 */
const registry = new Map<string, string>();
const calls: string[] = [];
const sql: string[] = [];
// Arrow as DuckDB-WASM answers it, IPC bytes, which mosaic-core decodes itself (from 0.30).
const answer = tableToIPC(tableFromArrays({ one: Int32Array.of(1) }), {});
/**
 * The pending-query protocol as the worker speaks it: `start` answers `null` while the statement runs,
 * `poll` answers the header when it is done or throws the worker's own error once it was cancelled,
 * `fetch` answers the rest of the stream and an empty chunk at its end. A statement naming `slow`
 * runs until released or cancelled. `inFlight` counts statements the connection holds at once.
 */
const running = { held: false, cancelled: false, released: false, release: () => {}, done: Promise.resolve() };
const live = { inFlight: 0, max: 0 };
const enter = () => (live.max = Math.max(live.max, ++live.inFlight));
const db = {
  instantiate: vi.fn<(module: string) => Promise<void>>(async () => {}),
  registerFileURL: vi.fn(async (name: string, url: string) => {
    if (registry.has(name) && registry.get(name) !== url) {
      throw new Error(`File already registered: ${name}`);
    }
    calls.push(`register ${name}`);
    registry.set(name, url);
  }),
  registerFileBuffer: vi.fn(async (name: string, bytes: Uint8Array) => {
    if (registry.has(name)) throw new Error(`File already registered: ${name}`);
    calls.push(`buffer ${name}`);
    registry.set(name, `buffer:${bytes.byteLength}`);
  }),
  dropFile: vi.fn(async (name: string) => {
    calls.push(`drop ${name}`);
    registry.delete(name);
  }),
  open: vi.fn(async () => {}),
  connect: vi.fn(async () => ({ useUnsafe: <R>(use: (bindings: unknown, conn: number) => R) => use(db, 7) })),
  runQuery: vi.fn(async (_conn: number, text: string) => {
    sql.push(text);
    enter();
    await new Promise((next) => setTimeout(next, 5));
    live.inFlight--;
    return answer;
  }),
  startPendingQuery: vi.fn(async (_conn: number, text: string) => {
    sql.push(text);
    enter();
    if (!text.includes("slow")) return null;
    running.held = true;
    running.cancelled = false;
    running.released = false;
    running.done = new Promise<void>(
      (resolve) =>
        (running.release = () => {
          running.released = true;
          resolve();
        }),
    );
    return null;
  }),
  pollPendingQuery: vi.fn(async () => {
    if (running.held) {
      await Promise.race([running.done, new Promise((next) => setTimeout(next, 5))]);
      if (running.cancelled) {
        running.held = false;
        live.inFlight--;
        throw new Error("query was canceled");
      }
      if (!running.released) return null;
    }
    running.held = false;
    live.inFlight--;
    return answer;
  }),
  fetchQueryResults: vi.fn(async () => new Uint8Array()),
  cancelPendingQuery: vi.fn(async () => {
    const was = running.held && !running.cancelled;
    running.cancelled = was;
    return was;
  }),
};
const workers: string[] = [];

vi.stubGlobal("location", new URL("https://page.test/docs/"));
vi.stubGlobal(
  "Worker",
  class {
    constructor(url: string) {
      workers.push(url);
    }
  },
);

vi.mock("@duckdb/duckdb-wasm", async (original) => ({
  ...(await original<typeof import("@duckdb/duckdb-wasm")>()),
  // What a browser with WebAssembly exceptions is given.
  selectBundle: async (bundles: { eh: { mainModule: string; mainWorker: string } }) => ({
    ...bundles.eh,
    pthreadWorker: null,
  }),
  AsyncDuckDB: function () {
    return db;
  },
}));

const { engine } = await import("./engine.js");

beforeEach(() => {
  calls.length = 0;
  running.held = false;
  running.cancelled = false;
  db.cancelPendingQuery.mockClear();
});

describe("engine", () => {
  it("is one per document, however many ask", async () => {
    const [a, b] = await Promise.all([engine(), engine()]);
    expect(a).toBe(b);
    expect(await engine()).toBe(a);
    expect(db.open).toHaveBeenCalledTimes(1);
  });

  it("opens the database refusing whole-file reads, so a lent file is read by range", async () => {
    await engine();
    expect(db.open).toHaveBeenCalledWith({ filesystem: { forceFullHTTPReads: false } });
  });

  // The CSP a host can hold is `'self'` because of this: no CDN, no `blob:` worker. Unbundled, the
  // specifier resolves against the module; a bundler resolves it to the dependency and emits it.
  it("boots the bundle it selected from the package's own DuckDB-WASM", async () => {
    await engine();
    expect(workers).toHaveLength(1);
    const worker = new URL(workers[0]!);
    const module = new URL(db.instantiate.mock.calls[0]![0]);
    expect(worker.pathname).toMatch(/\/@duckdb\/duckdb-wasm\/dist\/duckdb-browser-eh\.worker\.js$/);
    expect(module.pathname).toMatch(/\/@duckdb\/duckdb-wasm\/dist\/duckdb-eh\.wasm$/);
    expect([worker.protocol, module.protocol]).toEqual(["file:", "file:"]);
  });

  // Without httpfs a vended credential has nowhere to go: `CREATE SECRET (TYPE s3 …)` is httpfs's.
  // Without parquet there is no corpus, and no boot: `parquet_metadata_cache` is parquet's setting.
  // Without json, `read_json_auto` is not in the catalog: every JSON source a profile names fails.
  it("loads parquet, httpfs and json at boot, the builds for the bundle it booted, from beside the package", async () => {
    await engine();
    const loads = sql.filter((s) => s.startsWith("LOAD ")).map((s) => new URL(s.slice("LOAD '".length, -1)));
    expect(loads.map((url) => url.pathname.replace(/^.*\/extensions\//, ""))).toEqual([
      "wasm_eh/parquet.duckdb_extension.wasm",
      "wasm_eh/httpfs.duckdb_extension.wasm",
      "wasm_eh/json.duckdb_extension.wasm",
    ]);
    expect(loads.map((url) => url.protocol)).toEqual(["file:", "file:", "file:"]);
  });

  // An extension nobody loaded would otherwise be fetched from extensions.duckdb.org, past the CSP.
  it("turns autoloading off before it loads anything", async () => {
    await engine();
    const off = sql.indexOf("SET autoload_known_extensions = false");
    expect(off).toBeGreaterThanOrEqual(0);
    expect(off).toBeLessThan(sql.findIndex((s) => s.startsWith("LOAD ")));
  });

  it("applies its settings once, at boot", async () => {
    await engine();
    expect(sql.filter((s) => s.includes("enable_http_metadata_cache"))).toHaveLength(1);
    expect(sql.filter((s) => s.includes("parquet_metadata_cache"))).toHaveLength(1);
  });

  it("answers on the coordinator's own connection, in columns, uncached", async () => {
    const e = await engine();
    const before = sql.length;
    const first = await e.query("SELECT 1 AS one", { signal: new AbortController().signal });
    await e.query("SELECT 1 AS one", { signal: new AbortController().signal });
    expect(first.numRows).toBe(1);
    expect(first.getChild("one")?.toArray()).toEqual(Int32Array.of(1));
    // Twice through the connection: a statement with effects is never answered from the cache.
    expect(sql.slice(before)).toEqual(["SELECT 1 AS one", "SELECT 1 AS one"]);
  });

  // A hidden tab never fires `requestAnimationFrame`, and the coordinator batches every Arrow request
  // behind one: fossil's attach hung there with no error. The host's door must not wait for a frame,
  // and the charts' batching must stay as it is.
  it("answers in a tab that paints no frames, while the charts' queries still wait for one", async () => {
    const frames: FrameRequestCallback[] = [];
    const scope = globalThis as { requestAnimationFrame?: (callback: FrameRequestCallback) => number };
    scope.requestAnimationFrame = (callback) => frames.push(callback);
    try {
      const e = await engine();
      const answered = await e.query("SELECT 1 AS one", { signal: new AbortController().signal });
      expect(answered.getChild("one")?.toArray()).toEqual(Int32Array.of(1));

      const settled = vi.fn();
      const chart = e.coordinator.query("SELECT 2 AS one").then(settled);
      await new Promise((next) => setTimeout(next, 10));
      expect(settled).not.toHaveBeenCalled();
      expect(frames.length).toBeGreaterThan(0);
      for (const frame of frames.splice(0)) frame(0);
      await chart;
      expect(settled).toHaveBeenCalledOnce();
    } finally {
      delete scope.requestAnimationFrame;
    }
  });

  it("hands a refused statement's own error back, not a wrapper", async () => {
    const e = await engine();
    const refused = new Error("Catalog Error: Table with name nowhere does not exist");
    db.startPendingQuery.mockRejectedValueOnce(refused);
    await expect(e.query("SELECT * FROM nowhere", { signal: new AbortController().signal })).rejects.toBe(refused);
  });

  // The defect: the wait ended and the statement ran on, so the page stayed stuck behind it.
  it("interrupts a running statement on abort, rejects with the signal's reason, and answers the next", async () => {
    const e = await engine();
    const controller = new AbortController();
    const slow = e.query("SELECT slow", { signal: controller.signal });
    await vi.waitFor(() => expect(sql.at(-1)).toBe("SELECT slow"));
    expect(db.cancelPendingQuery).not.toHaveBeenCalled();
    controller.abort(new Error("stop"));
    await expect(slow).rejects.toBe(controller.signal.reason);
    expect(db.cancelPendingQuery).toHaveBeenCalledWith(7);
    expect((await e.query("SELECT 1 AS one", { signal: new AbortController().signal })).numRows).toBe(1);
  });

  it("never sends a statement whose signal was aborted before it asked", async () => {
    const e = await engine();
    const controller = new AbortController();
    controller.abort();
    await expect(e.query("SELECT never", { signal: controller.signal })).rejects.toBe(controller.signal.reason);
    expect(sql).not.toContain("SELECT never");
  });

  it("never sends a statement aborted while it waited for the one before it", async () => {
    const e = await engine();
    const first = e.query("SELECT slow", { signal: new AbortController().signal });
    await vi.waitFor(() => expect(sql.at(-1)).toBe("SELECT slow"));
    const controller = new AbortController();
    const waiting = e.query("SELECT waiting", { signal: controller.signal });
    controller.abort();
    await expect(waiting).rejects.toBe(controller.signal.reason);
    running.release();
    await first;
    await e.query("SELECT 1 AS one", { signal: new AbortController().signal });
    expect(sql).not.toContain("SELECT waiting");
    expect(db.cancelPendingQuery).not.toHaveBeenCalled();
  });

  // ADBC's `AdbcStatementCancel` on a statement with nothing running: there is nothing to interrupt.
  it("ignores an abort that arrives after the statement finished", async () => {
    const e = await engine();
    const controller = new AbortController();
    const done = await e.query("SELECT 1 AS one", { signal: controller.signal });
    controller.abort();
    expect(done.numRows).toBe(1);
    expect(db.cancelPendingQuery).not.toHaveBeenCalled();
  });

  // A pending query is several messages; a coordinator statement between them would end it.
  it("takes turns with the coordinator on the one connection, in the order they asked", async () => {
    const e = await engine();
    live.max = 0;
    const order: string[] = [];
    await Promise.all([
      e.query("SELECT 1 AS one", { signal: new AbortController().signal }).then(() => order.push("engine 1")),
      e.coordinator.exec("SELECT 2").then(() => order.push("coordinator")),
      e.query("SELECT 3 AS one", { signal: new AbortController().signal }).then(() => order.push("engine 2")),
    ]);
    expect(live.max).toBe(1);
    expect(order).toEqual(["engine 1", "coordinator", "engine 2"]);
  });

  it("registers a name once for the same URL", async () => {
    const e = await engine();
    await e.registerFiles({ "jobs/a/tiles.parquet": "https://x/tiles?sig=1" });
    await e.registerFiles({ "jobs/a/tiles.parquet": "https://x/tiles?sig=1" });
    expect(calls).toEqual(["register jobs/a/tiles.parquet"]);
  });

  // The reason `registerFiles` exists: a re-signed URL is a new string behind the same name.
  it("swaps the lease when the URL behind a name changes", async () => {
    const e = await engine();
    await e.registerFiles({ "jobs/b/tiles.parquet": "https://x/tiles?sig=1" });
    await e.registerFiles({ "jobs/b/tiles.parquet": "https://x/tiles?sig=2" });
    expect(calls).toEqual([
      "register jobs/b/tiles.parquet",
      "drop jobs/b/tiles.parquet",
      "register jobs/b/tiles.parquet",
    ]);
    expect(registry.get("jobs/b/tiles.parquet")).toBe("https://x/tiles?sig=2");
  });

  it("serialises concurrent registrations of one name", async () => {
    const e = await engine();
    await Promise.all([
      e.registerFiles({ "jobs/c/tiles.parquet": "https://x/tiles?sig=1" }),
      e.registerFiles({ "jobs/c/tiles.parquet": "https://x/tiles?sig=2" }),
    ]);
    expect(registry.get("jobs/c/tiles.parquet")).toBe("https://x/tiles?sig=2");
  });

  it("registers a copy of the bytes, replacing what was under the name", async () => {
    const e = await engine();
    const bytes = new Uint8Array([1, 2, 3]);
    await e.registerFiles({ tile: "https://x/tile" });
    await e.registerFileBuffer("tile", bytes);
    expect(calls).toEqual(["register tile", "drop tile", "buffer tile"]);
    expect(db.registerFileBuffer.mock.lastCall?.[1]).not.toBe(bytes);
    expect(bytes.byteLength).toBe(3);
  });

  it("drops what it holds, and ignores what it does not", async () => {
    const e = await engine();
    await e.registerFiles({ "jobs/d/a.parquet": "https://x/a", "jobs/d/b.parquet": "https://x/b" });
    calls.length = 0;
    await e.dropFiles(["jobs/d/a.parquet", "jobs/d/b.parquet", "never-lent"]);
    expect(calls).toEqual(["drop jobs/d/a.parquet", "drop jobs/d/b.parquet"]);
    // Dropped means forgotten: the same URL registers again rather than being taken as a no-op.
    await e.registerFiles({ "jobs/d/a.parquet": "https://x/a" });
    expect(calls.at(-1)).toBe("register jobs/d/a.parquet");
  });

  // DuckDB then spills or refuses with its own error while the worker lives, instead of the tab taking it.
  it("sets DuckDB's memory limit below WebAssembly's ceiling, from the device's memory where it says", async () => {
    const scope = globalThis as Record<symbol, unknown>;
    const key = Symbol.for("@kanzo-tech/mosaic/engine");
    const held = scope[key];
    const device = globalThis.navigator;
    const limit = async (memory: number | undefined) => {
      delete scope[key];
      vi.stubGlobal("navigator", memory === undefined ? {} : { deviceMemory: memory });
      const from = sql.length;
      await engine();
      return sql.slice(from).filter((statement) => statement.includes("memory_limit"));
    };
    try {
      expect(await limit(undefined)).toEqual(["SET memory_limit = '3072MiB'"]);
      expect(await limit(8)).toEqual(["SET memory_limit = '3072MiB'"]);
      expect(await limit(4)).toEqual(["SET memory_limit = '2048MiB'"]);
      expect(await limit(0.25)).toEqual(["SET memory_limit = '512MiB'"]);
    } finally {
      vi.stubGlobal("navigator", device);
      scope[key] = held;
    }
  });
});
