import { Problem } from "@kanzo-tech/kernel";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The boot against DuckDB-WASM's real `AsyncDuckDB` and a worker that misbehaves on cue: that class's
 * own handling of a worker `error` is the defect, so a mock of it would prove nothing.
 */
type Mode = "error" | "silent" | "answer";
let mode: Mode = "error";
const workers: FakeWorker[] = [];

/** What the worker answers the statement calls with: the header, then an empty chunk to end the stream. */
const replies: Record<string, string> = {
  START_PENDING_QUERY: "QUERY_RESULT_HEADER_OR_NULL",
  POLL_PENDING_QUERY: "QUERY_RESULT_HEADER_OR_NULL",
  FETCH_QUERY_RESULTS: "QUERY_RESULT_CHUNK",
};

class FakeWorker {
  readonly listeners = new Map<string, (event: unknown) => void>();
  terminated = false;
  readonly sent: string[] = [];
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
    this.sent.push(message.type);
    if (mode === "error") {
      queueMicrotask(() => this.listeners.get("error")?.({ message: "404 duckdb-browser-eh.worker.js" }));
    } else if (mode === "answer") {
      queueMicrotask(() =>
        this.listeners.get("message")?.({
          data: {
            requestId: message.messageId,
            type: message.type === "CONNECT" ? "CONNECTION_INFO" : (replies[message.type] ?? "OK"),
            data: message.type in replies ? new Uint8Array() : 0,
          },
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

const { engine, internalCoordinatorOf } = await import("./engine.js");

afterEach(() => {
  vi.useRealTimers();
});

describe("a boot that fails", () => {
  it("rejects as engine/unavailable when the worker fails to load, instead of waiting forever", async () => {
    mode = "error";
    const failure = await engine().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Problem);
    expect(failure).toMatchObject({ code: "engine/unavailable", data: {} });
    expect(workers.at(-1)!.terminated).toBe(true);
  });

  it("rejects with data.after when the worker never answers within the 60 s deadline", async () => {
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

describe("a worker that dies after the boot", () => {
  const scope = globalThis as Record<symbol, unknown>;
  const key = Symbol.for("@kanzo-tech/mosaic/engine");
  const signal = () => new AbortController().signal;

  /** An engine that booted, and then a worker that answers nothing more. */
  const booted = async () => {
    delete scope[key];
    mode = "answer";
    const e = await engine();
    const worker = workers.at(-1)!;
    mode = "silent";
    return { e, worker };
  };

  it("rejects what it held with engine/lost, instead of leaving it waiting", async () => {
    const { e, worker } = await booted();
    const held = e.query("SELECT 1", { signal: signal() }).catch((error: unknown) => error);
    await vi.waitFor(() => expect(worker.sent).toContain("START_PENDING_QUERY"));
    worker.listeners.get("error")?.({ message: "the worker crashed" });
    const failure = await held;
    expect(failure).toBeInstanceOf(Problem);
    expect(failure).toMatchObject({ code: "engine/lost", data: { reason: "worker" } });
    expect(worker.terminated).toBe(true);
  });

  it("says memory when the worker went for want of it", async () => {
    const { e, worker } = await booted();
    const held = e.query("SELECT 1", { signal: signal() }).catch((error: unknown) => error);
    await vi.waitFor(() => expect(worker.sent).toContain("START_PENDING_QUERY"));
    worker.listeners.get("error")?.({ message: "RuntimeError: memory access out of bounds" });
    expect(await held).toMatchObject({ code: "engine/lost", data: { reason: "memory" } });
  });

  it("takes a reply it cannot read for a dead worker", async () => {
    const { e, worker } = await booted();
    const held = e.query("SELECT 1", { signal: signal() }).catch((error: unknown) => error);
    await vi.waitFor(() => expect(worker.sent).toContain("START_PENDING_QUERY"));
    worker.listeners.get("messageerror")?.({});
    expect(await held).toMatchObject({ code: "engine/lost" });
  });

  it("refuses every later statement and file with the same loss, without waiting on the worker", async () => {
    const { e, worker } = await booted();
    worker.listeners.get("error")?.({ message: "the worker crashed" });
    const lost = await e.query("SELECT 1", { signal: signal() }).catch((error: unknown) => error);
    expect(lost).toMatchObject({ code: "engine/lost" });
    await expect(e.query("SELECT 2", { signal: signal() })).rejects.toBe(lost);
    await expect(e.registerFiles({ a: "https://x/a" })).rejects.toBe(lost);
    await expect(internalCoordinatorOf(e).exec("SELECT 3")).rejects.toBe(lost);
  });

  // A host that attached something to the dead engine asks again and attaches again: the new engine
  // is another object, so a count kept per engine object starts at zero.
  it("is forgotten, so the next ask boots another engine with another worker", async () => {
    const { e, worker } = await booted();
    worker.listeners.get("error")?.({ message: "the worker crashed" });
    mode = "answer";
    const before = workers.length;
    const again = await engine();
    expect(again).not.toBe(e);
    expect(workers.length).toBe(before + 1);
    expect(await engine()).toBe(again);
    const counts = new WeakMap<object, number>();
    counts.set(e, 3);
    expect(counts.get(again)).toBeUndefined();
  });

  it("does not take the loss of an engine it already replaced for the new one", async () => {
    const { e, worker } = await booted();
    worker.listeners.get("error")?.({ message: "the worker crashed" });
    mode = "answer";
    const again = await engine();
    worker.listeners.get("error")?.({ message: "late echo from the dead worker" });
    expect(await engine()).toBe(again);
    expect(e).not.toBe(again);
  });
});
