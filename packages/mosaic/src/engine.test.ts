import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A registry that refuses what DuckDB-WASM refuses: a name registered again under a different URL.
 * That rule is the defect `lend` exists for, so a fake without it would prove nothing.
 */
const registry = new Map<string, string>();
const calls: string[] = [];
const db = {
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
  getDuckDB: vi.fn(async () => db),
  query: vi.fn(async (request: { type: string; sql: string }) => {
    sql.push(request.sql);
    return request.type === "json" ? [{ one: 1 }] : undefined;
  }),
};
const booted = vi.fn(() => connector);

vi.mock("@uwdata/mosaic-core", async (original) => ({
  ...(await original<typeof import("@uwdata/mosaic-core")>()),
  wasmConnector: () => booted(),
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

  it("applies its settings once, at boot", async () => {
    await engine();
    expect(sql.filter((s) => s.includes("enable_http_metadata_cache"))).toHaveLength(1);
  });

  it("answers rows as objects", async () => {
    expect(await (await engine()).query("SELECT 1 AS one")).toEqual([{ one: 1 }]);
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
