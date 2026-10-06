import { beforeEach, describe, expect, it, vi } from "vitest";
import { tableFromArrays, tableToIPC } from "@uwdata/flechette";

/**
 * A registry that refuses what DuckDB-WASM refuses: a name registered again under a different URL.
 * That rule is the defect `lend` exists for, so a fake without it would prove nothing.
 */
const registry = new Map<string, string>();
const calls: string[] = [];
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
};
const sql: string[] = [];
/** Answers an arrow request with one column, and holds a statement naming `slow` until released. */
const running = { release: () => {} };
// Arrow as a connector answers it, IPC bytes, which mosaic-core decodes itself (from 0.30).
const answer = tableToIPC(tableFromArrays({ one: Int32Array.of(1) }), {});
const connector = {
  query: vi.fn(async (request: { type: string; sql: string }) => {
    sql.push(request.sql);
    if (request.sql.includes("slow")) await new Promise<void>((resolve) => (running.release = resolve));
    return request.type === "json" ? [{ one: 1 }] : answer;
  }),
};
const booted = vi.fn<(options?: unknown) => typeof connector>(() => connector);
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

vi.mock("@uwdata/mosaic-core", async (original) => ({
  ...(await original<typeof import("@uwdata/mosaic-core")>()),
  DuckDBWASMConnector: function (options?: unknown) {
    return booted(options);
  },
}));

const { engine } = await import("./engine.js");

beforeEach(() => {
  calls.length = 0;
});

describe("engine", () => {
  it("is one per document, however many ask", async () => {
    const [a, b] = await Promise.all([engine(), engine()]);
    expect(a).toBe(b);
    expect(await engine()).toBe(a);
    expect(booted).toHaveBeenCalledTimes(1);
  });

  it("opens the database refusing whole-file reads, so a lent file is read by range", async () => {
    await engine();
    expect(booted).toHaveBeenCalledWith({
      duckdb: db,
      config: { filesystem: { forceFullHTTPReads: false } },
    });
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

  // Without it a vended credential has nowhere to go: `CREATE SECRET (TYPE s3 …)` is httpfs's.
  it("loads httpfs at boot, the build for the bundle it booted, from beside the package", async () => {
    await engine();
    const loads = sql.filter((s) => s.startsWith("LOAD "));
    expect(loads).toHaveLength(1);
    const url = new URL(loads[0]!.slice("LOAD '".length, -1));
    expect(url.pathname).toMatch(/\/extensions\/wasm_eh\/httpfs\.duckdb_extension\.wasm$/);
    expect(url.protocol).toBe("file:");
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
    // Twice through the connector: a statement with effects is never answered from the cache.
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
    connector.query.mockRejectedValueOnce(refused);
    await expect(e.query("SELECT * FROM nowhere", { signal: new AbortController().signal })).rejects.toBe(refused);
  });

  it("rejects an aborted wait with the signal's reason, and the queue goes on", async () => {
    const e = await engine();
    const controller = new AbortController();
    const slow = e.query("SELECT slow", { signal: controller.signal });
    await vi.waitFor(() => expect(sql.at(-1)).toBe("SELECT slow"));
    controller.abort();
    await expect(slow).rejects.toBe(controller.signal.reason);
    running.release();
    expect((await e.query("SELECT 1 AS one", { signal: new AbortController().signal })).numRows).toBe(1);
  });

  it("never sends a statement whose signal was aborted before it asked", async () => {
    const e = await engine();
    const controller = new AbortController();
    controller.abort();
    await expect(e.query("SELECT never", { signal: controller.signal })).rejects.toBe(controller.signal.reason);
    expect(sql).not.toContain("SELECT never");
  });

  it("lends a name once for the same URL", async () => {
    const e = await engine();
    await e.lend({ "jobs/a/tiles.parquet": "https://x/tiles?sig=1" });
    await e.lend({ "jobs/a/tiles.parquet": "https://x/tiles?sig=1" });
    expect(calls).toEqual(["register jobs/a/tiles.parquet"]);
  });

  // The reason `lend` exists: a re-signed URL is a new string behind the same name.
  it("swaps the lease when the URL behind a name changes", async () => {
    const e = await engine();
    await e.lend({ "jobs/b/tiles.parquet": "https://x/tiles?sig=1" });
    await e.lend({ "jobs/b/tiles.parquet": "https://x/tiles?sig=2" });
    expect(calls).toEqual([
      "register jobs/b/tiles.parquet",
      "drop jobs/b/tiles.parquet",
      "register jobs/b/tiles.parquet",
    ]);
    expect(registry.get("jobs/b/tiles.parquet")).toBe("https://x/tiles?sig=2");
  });

  it("serialises concurrent lends of one name", async () => {
    const e = await engine();
    await Promise.all([
      e.lend({ "jobs/c/tiles.parquet": "https://x/tiles?sig=1" }),
      e.lend({ "jobs/c/tiles.parquet": "https://x/tiles?sig=2" }),
    ]);
    expect(registry.get("jobs/c/tiles.parquet")).toBe("https://x/tiles?sig=2");
  });

  it("holds a copy of the bytes, replacing what was under the name", async () => {
    const e = await engine();
    const bytes = new Uint8Array([1, 2, 3]);
    await e.lend({ tile: "https://x/tile" });
    await e.hold("tile", bytes);
    expect(calls).toEqual(["register tile", "drop tile", "buffer tile"]);
    expect(db.registerFileBuffer.mock.lastCall?.[1]).not.toBe(bytes);
    expect(bytes.byteLength).toBe(3);
  });

  it("drops what it holds, and ignores what it does not", async () => {
    const e = await engine();
    await e.lend({ "jobs/d/a.parquet": "https://x/a", "jobs/d/b.parquet": "https://x/b" });
    calls.length = 0;
    await e.drop(["jobs/d/a.parquet", "jobs/d/b.parquet", "never-lent"]);
    expect(calls).toEqual(["drop jobs/d/a.parquet", "drop jobs/d/b.parquet"]);
    // Dropped means forgotten: the same URL registers again rather than being taken as a no-op.
    await e.lend({ "jobs/d/a.parquet": "https://x/a" });
    expect(calls.at(-1)).toBe("register jobs/d/a.parquet");
  });
});
