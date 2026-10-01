import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The boot against DuckDB-WASM's real `AsyncDuckDB` and a worker that misbehaves on cue: that class's
 * own handling of a worker `error` is the defect, so a mock of it would prove nothing.
 */
type Mode = "error" | "silent" | "answer";
let mode: Mode = "error";
const workers: FakeWorker[] = [];

class FakeWorker {
  readonly listeners = new Map<string, (event: unknown) => void>();
  terminated = false;
  constructor() {
    workers.push(this);
  }
  addEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners.set(type, listener);
  }
  removeEventListener(type: string) {
    this.listeners.delete(type);
  }
  terminate() {
    this.terminated = true;
  }
  postMessage(message: { messageId: number; type: string }) {
    if (mode === "error") {
      queueMicrotask(() => this.listeners.get("error")?.({ message: "404 duckdb-browser-eh.worker.js" }));
    } else if (mode === "answer") {
      queueMicrotask(() =>
        this.listeners.get("message")?.({
          data: { requestId: message.messageId, type: message.type === "CONNECT" ? "CONNECTION_INFO" : "OK", data: 0 },
        }),
      );
    }
  }
}

vi.stubGlobal("location", new URL("https://page.test/docs/"));
vi.stubGlobal("Worker", FakeWorker);
vi.spyOn(console, "error").mockImplementation(() => {});

vi.mock("@duckdb/duckdb-wasm", async (original) => ({
  ...(await original<typeof import("@duckdb/duckdb-wasm")>()),
  selectBundle: async (bundles: { eh: { mainModule: string; mainWorker: string } }) => ({
    ...bundles.eh,
    pthreadWorker: null,
  }),
}));

vi.mock("@uwdata/mosaic-core", async (original) => ({
  ...(await original<typeof import("@uwdata/mosaic-core")>()),
  wasmConnector: () => ({ query: async () => undefined }),
}));

const { engine, EngineError } = await import("./engine.js");

afterEach(() => {
  vi.useRealTimers();
});

describe("a boot that fails", () => {
  it("rejects as engine/unavailable when the worker fails to load, instead of waiting forever", async () => {
    mode = "error";
    const failure = await engine().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(EngineError);
    expect(failure).toMatchObject({ code: "engine/unavailable", data: {} });
    expect(workers.at(-1)!.terminated).toBe(true);
  });

  it("rejects with { after } when the worker never answers within the 60 s deadline", async () => {
    vi.useFakeTimers();
    mode = "silent";
    const booting = engine().catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(59_999);
    await vi.advanceTimersByTimeAsync(1);
    expect(await booting).toMatchObject({ code: "engine/unavailable", data: { after: 60_000 } });
  });

  it("is not remembered: the next ask boots again, and can succeed", async () => {
    mode = "answer";
    const before = workers.length;
    const e = await engine();
    expect(workers.length).toBe(before + 1);
    expect(await engine()).toBe(e);
  });
});

describe("a caller's signal", () => {
  it("ends that caller's wait with its reason, and leaves the boot to the others", async () => {
    vi.useFakeTimers();
    const scope = globalThis as Record<symbol, unknown>;
    delete scope[Symbol.for("@kanzo-tech/mosaic/engine")];
    mode = "silent";
    const controller = new AbortController();
    const mine = engine({ signal: controller.signal }).catch((error: unknown) => error);
    const theirs = engine().catch((error: unknown) => error);
    controller.abort();
    expect(await mine).toBe(controller.signal.reason);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(await theirs).toMatchObject({ code: "engine/unavailable", data: { after: 60_000 } });
  });
});
