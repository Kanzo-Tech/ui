import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A registry that refuses what DuckDB-WASM refuses: a name registered again under a different URL.
 * That rule is the defect `lend` exists for, so a fake without it would prove nothing.
 */
const registry = new Map<string, string>();
const calls: string[] = [];
/**
 * A connection that answers after a turn, so an abort can land while a statement runs — and records
 * the interrupt, which is the thing an abort owes the engine rather than only its caller.
 */
const sent: string[] = [];
const interrupts = vi.fn(async () => true);
const running = { release: () => {} };
const connection = {
  send: vi.fn(async (text: string) => {
    sent.push(text);
    if (text.includes("slow")) await new Promise<void>((resolve) => (running.release = resolve));
    const column = { length: 1, get: () => 1, toArray: () => Int32Array.of(1), concat: () => column };
    const batch = { numRows: 1, getChildAt: (i: number) => (i === 0 ? column : null) };
    // As apache-arrow's reader behaves: a schema only while open, and none once iterated to the end.
    let schema: { fields: { name: string }[] } | undefined;
    return {
      get schema() {
        return schema;
      },
      async open() {
        schema = { fields: [{ name: "one" }] };
      },
      async *[Symbol.asyncIterator]() {
        yield batch;
        schema = undefined;
      },
    };
  }),
  cancelSent: interrupts,
};
const db = {
  connect: vi.fn(async () => connection),
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
const connector = {
  query: vi.fn(async (request: { type: string; sql: string }) => {
    sql.push(request.sql);
    return request.type === "json" ? [{ one: 1 }] : undefined;
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
  wasmConnector: (options?: unknown) => booted(options),
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

  it("answers in columns, as DuckDB-WASM produced them", async () => {
    const answer = await (await engine()).query("SELECT 1 AS one", { signal: new AbortController().signal });
    expect(answer.numRows).toBe(1);
    expect(answer.schema.fields.map((f) => f.name)).toEqual(["one"]);
    expect(answer.getChild("one")?.toArray()).toEqual(Int32Array.of(1));
    expect(answer.getChild("two")).toBeNull();
  });

  it("interrupts the running statement on abort, and rejects with the signal's reason", async () => {
    const e = await engine();
    const controller = new AbortController();
    const slow = e.query("SELECT slow", { signal: controller.signal });
    await vi.waitFor(() => expect(sent.at(-1)).toBe("SELECT slow"));
    controller.abort();
    await expect(slow).rejects.toBe(controller.signal.reason);
    expect(interrupts).toHaveBeenCalledTimes(1);
    running.release();
    // The connection answers the next statement as if the aborted one had never been sent.
    expect((await e.query("SELECT 1 AS one", { signal: new AbortController().signal })).numRows).toBe(1);
  });

  it("never sends a statement whose signal was aborted while it waited", async () => {
    const e = await engine();
    const first = e.query("SELECT slow", { signal: new AbortController().signal });
    await vi.waitFor(() => expect(sent.at(-1)).toBe("SELECT slow"));
    const controller = new AbortController();
    const queued = e.query("SELECT queued", { signal: controller.signal });
    controller.abort();
    await expect(queued).rejects.toBe(controller.signal.reason);
    running.release();
    await first;
    await e.query("SELECT after", { signal: new AbortController().signal });
    expect(sent).not.toContain("SELECT queued");
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
